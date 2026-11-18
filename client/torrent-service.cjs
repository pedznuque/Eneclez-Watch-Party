const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const ffmpegPath = require("ffmpeg-static").replace("app.asar", "app.asar.unpacked");
const { parseTorrentLink } = require("./src/js/torrent-links");
const STREAM_CHUNK_SIZE = 4 * 1024 * 1024;
const MiB = 1024 * 1024;

function subtitleStreams(log) {
    return log.split(/(?=^\s*Stream #0:)/m).flatMap(block => {
        const match = block.match(/^\s*Stream #0:(\d+)(?:\[[^\]]+\])?(?:\(([^)]+)\))?: Subtitle: ([\w]+)/m);
        if (!match) return [];
        const codec = match[3];
        const kind = /^(hdmv_pgs_subtitle|dvd_subtitle|dvb_subtitle|xsub)$/.test(codec) ? "bitmap" : /^(subrip|ass|ssa|webvtt|mov_text|text)$/.test(codec) ? "text" : "unsupported";
        const language = match[2] || "und";
        const title = block.match(/^\s+title\s*:\s*(.+)$/im)?.[1]?.trim();
        return [{ index: Number(match[1]), codec, kind, language, default: /\(default\)/.test(block), label: title ? `${language.toUpperCase()} - ${title}` : `${language.toUpperCase()} (${codec})` }];
    });
}

function readAheadBytes(fileLength, duration, downloadSpeed = 0) {
    const sourceRate = duration > 0 && Number.isFinite(duration) ? fileLength / duration : 512 * 1024;
    // Keep roughly one minute available without selecting the entire movie.
    const rate = Math.max(sourceRate, Number(downloadSpeed) || 0);
    return Math.ceil(Math.min(64 * MiB, Math.max(16 * MiB, rate * 60)));
}

function startupRanges(file, pieceLength) {
    if (!file.length || !pieceLength) return [];
    const first = Math.floor(file.offset / pieceLength);
    const last = Math.floor((file.offset + file.length - 1) / pieceLength);
    const headEnd = Math.min(last, first + Math.ceil(2 * 1024 * 1024 / pieceLength) - 1);
    const ranges = [{ start: first, end: headEnd }];
    const tailStart = Math.max(headEnd + 1, last - Math.ceil(1024 * 1024 / pieceLength) + 1);
    if (tailStart <= last) ranges.push({ start: tailStart, end: last });
    return ranges;
}

function parseRange(header, length) {
    if (!header) return { start: 0, end: length - 1, partial: false };
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match || (!match[1] && !match[2])) return null;
    const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(length - 1, Number(match[2])) : length - 1;
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < length ? { start, end, partial: true } : null;
}

class TorrentService {
    constructor(cachePath, clientOptions = {}) {
        this.cachePath = cachePath;
        this.clientOptions = clientOptions;
        this.token = crypto.randomBytes(24).toString("hex");
        this.server = null;
        this.client = null;
        this.current = null;
        this.pending = null;
        this.error = "";
        this.generation = 0;
        this.startupSelections = [];
        this.playbackSelection = null;
        this.preferredFileIndex = null;
        this.converters = new Set();
        this.mediaInfo = new Map();
        this.fileDurations = new Map();
        this.conversionError = "";
    }
    async initialize() {
        if (this.initializing) return this.initializing;
        if (this.client && this.server?.listening) return;
        this.initializing = this.start();
        try { await this.initializing; } finally { this.initializing = null; }
    }
    async start() {
        const { default: WebTorrent } = await import("webtorrent");
        this.client = new WebTorrent({ maxConns: 100, utp: false, ...this.clientOptions });
        this.client.on("error", error => { this.error = error.message; });
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        // Peer stalls are not the end of the HTTP media resource.
        this.server.timeout = 0;
        await new Promise((resolve, reject) => { this.server.once("error", reject); this.server.listen(0, "127.0.0.1", resolve); });
    }
    describe() {
        const torrent = this.current;
        if (!torrent) throw new Error("No torrent loaded");
        return {
            name: torrent.name, hash: torrent.infoHash, magnet: torrent.magnetURI,
            files: torrent.files.map((file, index) => ({ index, name: file.name, length: file.length, downloaded: file.downloaded })).filter(file => /\.(mp4|webm|mkv|m4v|mov|ogv)$/i.test(file.name)),
            progress: torrent.progress, peers: torrent.numPeers, downloadSpeed: torrent.downloadSpeed, uploadSpeed: torrent.uploadSpeed, error: this.error,
            preferredFileIndex: this.preferredFileIndex, conversionError: this.conversionError
        };
    }
    async prepare(input) {
        const generation = this.generation;
        await this.initialize();
        if (generation !== this.generation) throw new Error("Torrent request canceled");
        if (this.pending) throw new Error("A torrent is already loading. Wait for metadata or stop the transfer first.");
        const parsed = typeof input === "string" ? parseTorrentLink(input) : null;
        if (typeof input === "string" && !parsed) throw new Error("Enter a valid BitTorrent magnet link (maximum 2048 characters).");
        if (parsed && this.current && (this.current.infoHash === parsed.hash || this.current.magnetURI === parsed.magnet)) return this.describe();
        await this.stop();
        this.error = "";
        return new Promise((resolve, reject) => {
            let torrent;
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                this.pending = null;
                if (error) { this.error = error.message; reject(error); }
                else resolve(this.describe());
            };
            const timeout = setTimeout(() => {
                finish(new Error("Torrent metadata timed out. Check the magnet link and available peers."));
                if (torrent && !torrent.destroyed) torrent.destroy();
                if (this.current === torrent) this.current = null;
            }, 45000);
            this.pending = () => finish(new Error("Torrent loading stopped"));
            try {
                torrent = this.client.add(parsed ? parsed.magnet : input, { path: this.cachePath, deselect: true, strategy: "sequential" }, ready => {
                    this.current = ready;
                    const videos = ready.files.map((file, index) => ({ file, index })).filter(entry => /\.(mp4|webm|mkv|m4v|mov|ogv)$/i.test(entry.file.name));
                    videos.sort((first, second) => Number(/\.(mp4|webm|m4v)$/i.test(second.file.name)) - Number(/\.(mp4|webm|m4v)$/i.test(first.file.name)) || second.file.length - first.file.length);
                    if (videos.length) this.prioritize(videos[0].index);
                    finish();
                });
                this.current = torrent;
                torrent.on("error", error => { this.error = error.message; finish(error); });
            } catch (error) { finish(error); }
        });
    }
    prioritize(fileIndex) {
        const torrent = this.current;
        const file = torrent?.files[fileIndex];
        if (!file || !/\.(mp4|webm|mkv|m4v|mov|ogv)$/i.test(file.name)) throw new Error("Choose a video file in the torrent");
        if (this.preferredFileIndex === fileIndex) return;
        if (this.playbackSelection) torrent.deselect(this.playbackSelection.start, this.playbackSelection.end);
        this.playbackSelection = null;
        this.startupSelections.forEach(range => torrent.deselect(range.start, range.end));
        this.startupSelections = startupRanges(file, torrent.pieceLength);
        this.preferredFileIndex = fileIndex;
        this.startupSelections.forEach((range, index) => {
            torrent.select(range.start, range.end, 10 + index);
            torrent.critical(range.start, range.end);
        });
    }
    player(fileIndex) {
        this.prioritize(fileIndex);
        const torrent = this.current;
        return `http://127.0.0.1:${this.server.address().port}/${this.token}/player?hash=${torrent.infoHash}&file=${fileIndex}`;
    }
    prioritizeStream(file, start) {
        const torrent = this.current;
        // Once playback starts, missing opening/tail pieces must not outrank a
        // new seek. Keep a bounded rolling window ahead of the latest request.
        this.startupSelections.forEach(range => torrent.deselect(range.start, range.end));
        this.startupSelections = [];
        if (this.playbackSelection) torrent.deselect(this.playbackSelection.start, this.playbackSelection.end);
        const first = Math.floor((file.offset + start) / torrent.pieceLength);
        const ahead = readAheadBytes(file.length, this.fileDurations.get(file), torrent.downloadSpeed);
        const endByte = Math.min(file.length - 1, start + STREAM_CHUNK_SIZE + ahead - 1);
        const last = Math.floor((file.offset + endByte) / torrent.pieceLength);
        this.playbackSelection = { start: first, end: last };
        torrent.select(first, last, 5);
        torrent.critical(first, Math.min(last, first + Math.ceil(1024 * 1024 / torrent.pieceLength) - 1));
    }
    createPlaybackStream(file, start, end) {
        const service = this;
        const torrent = this.current;
        let activeStream;
        let canceled = false;
        const output = Readable.from((async function* () {
            for (let position = start; position <= end && !canceled; position += STREAM_CHUNK_SIZE) {
                if (service.current !== torrent || torrent.destroyed) throw new Error("Torrent transfer stopped");
                service.prioritizeStream(file, position);
                activeStream = file.createReadStream({ start: position, end: Math.min(end, position + STREAM_CHUNK_SIZE - 1) });
                try {
                    for await (const chunk of activeStream) {
                        if (canceled) return;
                        yield chunk;
                    }
                } finally { activeStream.destroy(); }
            }
        })(), {
            objectMode: false, highWaterMark: 64 * 1024,
            destroy(error, callback) {
                // Cancel the inner reader before waiting for the async iterator
                // to finish; it may be blocked waiting for an unavailable piece.
                canceled = true;
                activeStream?.destroy();
                callback(error);
            }
        });
        return output;
    }
    inspectMedia(fileIndex) {
        const torrent = this.current;
        const key = `${torrent.infoHash}:${fileIndex}`;
        if (this.mediaInfo.has(key)) return this.mediaInfo.get(key);
        const input = `http://127.0.0.1:${this.server.address().port}/${this.token}/stream?hash=${torrent.infoHash}&file=${fileIndex}`;
        const task = new Promise((resolve, reject) => {
            const process = spawn(ffmpegPath, ["-hide_banner", "-nostdin", "-analyzeduration", "2000000", "-probesize", "4194304", "-i", input, "-map", "0:v:0", "-t", "0", "-f", "null", "-"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
            this.converters.add(process);
            let log = "";
            const timeout = setTimeout(() => { process.kill(); reject(new Error("Video inspection timed out. Check available torrent peers.")); }, 30000);
            process.stderr.on("data", chunk => { log = (log + chunk.toString()).slice(-65536); });
            process.on("error", () => reject(new Error("Compatibility converter is unavailable. Reinstall the updated desktop app.")));
            process.on("close", () => {
                clearTimeout(timeout);
                this.converters.delete(process);
                const time = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
                const videoCodec = log.match(/Video: ([\w]+)/)?.[1] || "unknown";
                const audioCodec = log.match(/Audio: ([\w]+)/)?.[1] || "none";
                if (!time) { reject(new Error("Could not read video metadata. The torrent may still be missing header pieces.")); return; }
                const duration = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
                if (this.current === torrent) this.fileDurations.set(torrent.files[fileIndex], duration);
                resolve({ duration, videoCodec, audioCodec, subtitles: subtitleStreams(log) });
            });
        });
        this.mediaInfo.set(key, task);
        task.catch(() => this.mediaInfo.delete(key));
        return task;
    }
    transcode(fileIndex, start, res, subtitle = null) {
        this.conversionError = "";
        const input = `http://127.0.0.1:${this.server.address().port}/${this.token}/stream?hash=${this.current.infoHash}&file=${fileIndex}`;
        const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-ss", String(start), "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p", "-vf", "scale=w='min(1280,iw)':h=-2", "-threads", "2", "-c:a", "aac", "-ac", "2", "-b:a", "128k", "-g", "48", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4", "pipe:1"];
        if (subtitle !== null) {
            // Decode a short preroll so a caption that began before the seek
            // is available to the overlay; trim that preroll from the output.
            const inputStart = Math.max(0, start - 30);
            args[args.indexOf("-ss") + 1] = String(inputStart);
            args.splice(args.indexOf("-map"), 0, "-ss", String(start - inputStart));
            args.splice(args.indexOf("-map") + 1, 1, "[captioned]");
            const filter = args.indexOf("-vf");
            args.splice(filter, 2, "-filter_complex", `[0:v:0][0:${subtitle}]overlay=eof_action=pass:shortest=0,scale=w='min(1280,iw)':h=-2[captioned]`);
        }
        const process = spawn(ffmpegPath, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        this.converters.add(process);
        let canceled = false;
        res.writeHead(200, { "Content-Type": "video/mp4", "Accept-Ranges": "none" });
        process.stdout.pipe(res);
        process.stderr.resume();
        process.on("error", () => { this.conversionError = "Compatibility converter could not start. Reinstall the updated desktop app."; res.destroy(); });
        process.on("close", code => {
            this.converters.delete(process);
            if (code && !canceled) this.conversionError = "Compatibility conversion failed. Check the torrent peers or try another video file.";
            if (!res.writableEnded) res.end();
        });
        res.on("close", () => { canceled = true; process.kill(); });
    }
    streamSubtitles(fileIndex, subtitle, start, res) {
        const input = `http://127.0.0.1:${this.server.address().port}/${this.token}/stream?hash=${this.current.infoHash}&file=${fileIndex}`;
        const inputStart = Math.max(0, start - 30);
        const process = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-nostdin", "-copyts", "-ss", String(inputStart), "-t", String(start - inputStart + 120), "-i", input, "-map", `0:${subtitle}`, "-to", String(start + 120), "-c:s", "webvtt", "-f", "webvtt", "-flush_packets", "1", "pipe:1"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        this.converters.add(process);
        res.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
        process.stdout.pipe(res);
        process.stderr.resume();
        process.on("error", () => res.destroy());
        process.on("close", code => {
            this.converters.delete(process);
            if (code && !res.destroyed) res.destroy();
            else if (!res.writableEnded) res.end();
        });
        res.on("close", () => process.kill());
    }
    handleRequest(req, res) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const url = new URL(req.url, "http://127.0.0.1");
        if (!url.pathname.startsWith(`/${this.token}/`) || !["GET", "HEAD"].includes(req.method)) { res.writeHead(404); res.end(); return; }
        const route = url.pathname.slice(this.token.length + 2);
        if (route === "player" || route === "torrent-player.js" || route === "torrent-links.js" || route === "torrent-subtitles.js") {
            const filename = route === "player" ? "torrent-player.html" : `js/${route}`;
            res.setHeader("Content-Type", route === "player" ? "text/html; charset=utf-8" : "application/javascript; charset=utf-8");
            fs.createReadStream(path.join(__dirname, "src", filename)).on("error", () => res.destroy()).pipe(res);
            return;
        }
        const torrent = this.current;
        if (!torrent || torrent.infoHash !== url.searchParams.get("hash")) { res.writeHead(410); res.end("Torrent transfer stopped"); return; }
        if (route === "status") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(this.describe())); return; }
        const file = torrent.files[Number(url.searchParams.get("file"))];
        if ((route === "media-info" || route === "transcode" || route === "subtitles") && file) {
            if (route === "media-info") {
                this.inspectMedia(Number(url.searchParams.get("file"))).then(info => {
                    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(info));
                }).catch(error => { if (!res.destroyed) { res.writeHead(502, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.message })); } });
                return;
            }
            const start = Number(url.searchParams.get("start") || 0);
            if (!Number.isFinite(start) || start < 0 || start > 604800) { res.writeHead(400); res.end(); return; }
            if (req.method === "HEAD") { res.writeHead(200, { "Content-Type": "video/mp4" }); res.end(); return; }
            if (route === "subtitles" || url.searchParams.has("subtitle")) {
                const subtitle = Number(url.searchParams.get("subtitle"));
                this.inspectMedia(Number(url.searchParams.get("file"))).then(info => {
                    if (res.destroyed) return;
                    const track = info.subtitles.find(track => track.index === subtitle && track.kind === (route === "subtitles" ? "text" : "bitmap"));
                    if (!Number.isSafeInteger(subtitle) || !track) { res.writeHead(422); res.end("Unsupported subtitle track"); return; }
                    if (route === "subtitles") this.streamSubtitles(Number(url.searchParams.get("file")), subtitle, start, res);
                    else this.transcode(Number(url.searchParams.get("file")), start, res, subtitle);
                }).catch(error => { if (!res.destroyed) { res.writeHead(502); res.end(error.message); } });
            } else this.transcode(Number(url.searchParams.get("file")), start, res);
            return;
        }
        if (route !== "stream" || !file) { res.writeHead(404); res.end(); return; }
        const range = parseRange(req.headers.range, file.length);
        if (!range) { res.writeHead(416, { "Content-Range": `bytes */${file.length}` }); res.end(); return; }
        const types = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska", ".mov": "video/quicktime", ".ogv": "video/ogg" };
        const headers = { "Content-Type": types[path.extname(file.name).toLowerCase()] || "application/octet-stream", "Accept-Ranges": "bytes", "Content-Length": range.end - range.start + 1 };
        if (range.partial) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${file.length}`;
        res.writeHead(range.partial ? 206 : 200, headers);
        if (req.method === "HEAD") { res.end(); return; }
        const stream = this.createPlaybackStream(file, range.start, range.end);
        stream.on("error", () => res.destroy());
        res.on("close", () => stream.destroy());
        stream.pipe(res);
    }
    async stop() {
        this.generation += 1;
        for (const process of this.converters) process.kill();
        this.converters.clear();
        this.mediaInfo.clear();
        this.fileDurations.clear();
        this.conversionError = "";
        this.pending?.();
        this.pending = null;
        const torrent = this.current;
        this.current = null;
        this.startupSelections = [];
        this.playbackSelection = null;
        this.preferredFileIndex = null;
        if (torrent && !torrent.destroyed) await new Promise(resolve => torrent.destroy(resolve));
    }
    async destroy() {
        await this.stop();
        if (this.server) this.server.close();
        if (this.client) await new Promise(resolve => this.client.destroy(resolve));
        this.server = null;
        this.client = null;
    }
}

module.exports = { TorrentService, parseRange, startupRanges, readAheadBytes, subtitleStreams };
