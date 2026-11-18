const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
const { TorrentService, readAheadBytes, subtitleStreams } = require("../torrent-service.cjs");
const { parseSubtitleCues } = require("../src/js/torrent-subtitles.js");
const MiB = 1024 * 1024;

async function fixture(t, file) {
    const selections = [];
    const service = new TorrentService("unused");
    service.current = {
        infoHash: "test", pieceLength: 256 * 1024, files: [file],
        select: (start, end) => selections.push({ start, end }), deselect() {}, critical() {}
    };
    service.server = http.createServer((req, res) => service.handleRequest(req, res));
    service.server.listen(0, "127.0.0.1");
    await once(service.server, "listening");
    t.after(async () => {
        for (const converter of service.converters) converter.kill();
        service.server.closeAllConnections();
        await new Promise(resolve => service.server.close(resolve));
    });
    const base = `http://127.0.0.1:${service.server.address().port}/${service.token}`;
    return { service, selections, url: `${base}/stream?hash=test&file=0`, base };
}

test("HTTP range continues beyond 4 MiB while torrent reads stay bounded", async t => {
    const bytes = Buffer.alloc(11 * MiB + 17, 0x5a);
    const reads = [];
    const file = { name: "video.mp4", offset: 0, length: bytes.length,
        createReadStream(range) { reads.push(range); return Readable.from([bytes.subarray(range.start, range.end + 1)]); } };
    const { url, selections } = await fixture(t, file);
    const response = await fetch(url, { headers: { Range: "bytes=123-" } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), `bytes 123-${bytes.length - 1}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(123));
    assert.ok(reads.length >= 3, "one HTTP request must advance through multiple torrent windows");
    assert.ok(reads.every(range => range.end - range.start + 1 <= 4 * MiB));
    assert.ok(selections.length >= 3);
    assert.ok(selections.every(range => (range.end - range.start + 1) * 256 * 1024 <= 68.25 * MiB));
    const suffix = await fetch(url, { headers: { Range: "bytes=-19" } });
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), bytes.subarray(-19));
    const invalid = await fetch(url, { headers: { Range: `bytes=${bytes.length}-` } });
    assert.equal(invalid.status, 416);
});

test("read-ahead grows with source bitrate and available speed but stays bounded", () => {
    assert.equal(readAheadBytes(1024 * MiB, 3600), Math.ceil(1024 * MiB / 3600 * 60));
    assert.equal(readAheadBytes(100 * MiB, 3600), 16 * MiB);
    assert.equal(readAheadBytes(1024 * MiB, 3600, 10 * MiB), 64 * MiB);
    assert.equal(readAheadBytes(1024 * MiB, undefined), 30 * MiB);
});

test("disconnect cancels the current torrent reader", async t => {
    let reader;
    const file = { name: "video.mp4", offset: 0, length: 100 * MiB,
        createReadStream() {
            let sent = false;
            reader = new Readable({ read() { if (!sent) { sent = true; this.push(Buffer.alloc(65536)); } } });
            return reader;
        } };
    const { url } = await fixture(t, file);
    const response = await fetch(url, { headers: { Range: "bytes=0-" } });
    await response.body.cancel();
    for (let i = 0; i < 100 && !reader.destroyed; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(reader.destroyed, true);
});

test("compatibility conversion reaches the end of a source larger than 4 MiB", { timeout: 60000 }, async t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "watchparty-continuity-"));
    t.after(() => {
        const resolved = path.resolve(temp);
        assert.ok(resolved.startsWith(path.join(os.tmpdir(), "watchparty-continuity-")));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const media = path.join(temp, "large.mkv");
    const ffmpeg = require("ffmpeg-static");
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "16", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "4000k", "-minrate", "4000k", "-maxrate", "4000k", "-bufsize", "4000k", "-x264-params", "nal-hrd=cbr", "-y", media], { windowsHide: true });
    const length = fs.statSync(media).size;
    assert.ok(length > 6 * MiB);
    const file = { name: "large.mkv", length, offset: 0, createReadStream: range => fs.createReadStream(media, range) };
    const { base, service } = await fixture(t, file);
    const decoder = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", `${base}/transcode?hash=test&file=0`, "-progress", "pipe:1", "-f", "null", "-"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    t.after(() => decoder.kill());
    let progress = "", errors = "";
    decoder.stdout.on("data", chunk => { progress += chunk; });
    decoder.stderr.on("data", chunk => { errors += chunk; });
    const [code] = await once(decoder, "close");
    assert.equal(code, 0, errors);
    const times = [...progress.matchAll(/out_time_us=(\d+)/g)].map(match => Number(match[1]) / 1e6);
    assert.ok(Math.max(...times) >= 15.8, `Conversion stopped early: ${Math.max(...times)}s; ${service.conversionError}; ${errors}`);
});

test("real peer streaming crosses chunk boundaries without a download speed cap", { timeout: 60000 }, async t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "watchparty-peer-"));
    let seed, service;
    t.after(async () => {
        await service?.destroy();
        if (seed) await new Promise(resolve => seed.destroy(resolve));
        const resolved = path.resolve(temp);
        assert.ok(resolved.startsWith(path.join(os.tmpdir(), "watchparty-peer-")));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const bytes = randomBytes(16 * MiB);
    const media = path.join(temp, "stream.mp4");
    fs.writeFileSync(media, bytes);
    const { default: WebTorrent } = await import("webtorrent");
    const options = { dht: false, tracker: false, lsd: false, natUpnp: false, natPmp: false };
    seed = new WebTorrent(options);
    const torrent = await new Promise((resolve, reject) => { seed.once("error", reject); seed.seed(media, { announce: [] }, resolve); });
    service = new TorrentService(path.join(temp, "cache"), options);
    await service.prepare(torrent.torrentFile);
    assert.equal(service.client._downloadLimit, -1);
    service.current.addPeer(`127.0.0.1:${seed.torrentPort}`);
    const url = service.player(0).replace("/player?", "/stream?");
    const start = Date.now();
    const response = await fetch(url, { headers: { Range: "bytes=0-" }, signal: AbortSignal.timeout(30000) });
    const actual = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(actual, bytes);
    const elapsed = Date.now() - start;
    console.log(`Local peer: 16 MiB in ${elapsed}ms (${Math.round(bytes.length / Math.max(1, elapsed) * 1000 / 1024)} KiB/s), uTP support=${service.client.utp}`);
});

function pgsSample() {
    const packet = (type, data, seconds = 1) => {
        const header = Buffer.alloc(13);
        header.write("PG"); header.writeUInt32BE(seconds * 90000, 2); header.writeUInt32BE(seconds * 90000, 6);
        header[10] = type; header.writeUInt16BE(data.length, 11);
        return Buffer.concat([header, data]);
    };
    const composition = (count, number = 0) => {
        const data = Buffer.alloc(count ? 19 : 11);
        data.writeUInt16BE(320, 0); data.writeUInt16BE(180, 2); data[4] = 0x20;
        data.writeUInt16BE(number, 5); data[7] = number ? 0 : 0x80; data[10] = count;
        if (count) { data.writeUInt16BE(20, 15); data.writeUInt16BE(20, 17); }
        return data;
    };
    const window = Buffer.from([1, 0, 0, 20, 0, 20, 0, 16, 0, 8]);
    const palette = Buffer.from([0, 0, 0, 16, 128, 128, 0, 1, 235, 128, 128, 255]);
    const pixels = Buffer.from(Array.from({ length: 8 }, () => [...Array(16).fill(1), 0, 0]).flat());
    const object = Buffer.alloc(11); object[3] = 0xc0;
    object.writeUIntBE(pixels.length + 4, 4, 3); object.writeUInt16BE(16, 7); object.writeUInt16BE(8, 9);
    return Buffer.concat([packet(0x16, composition(1)), packet(0x17, window), packet(0x14, palette), packet(0x15, Buffer.concat([object, pixels])), packet(0x80, Buffer.alloc(0)), packet(0x16, composition(0, 1), 4), packet(0x80, Buffer.alloc(0), 4)]);
}

test("embedded text subtitles stream with seek timing and PGS captions render into video", { timeout: 60000 }, async t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "watchparty-subtitles-"));
    t.after(() => {
        const resolved = path.resolve(temp);
        assert.ok(resolved.startsWith(path.join(os.tmpdir(), "watchparty-subtitles-")));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const srt = path.join(temp, "captions.srt"), sup = path.join(temp, "captions.sup"), media = path.join(temp, "captioned.mkv");
    fs.writeFileSync(srt, "1\n00:00:01,000 --> 00:00:04,000\nFirst caption\n\n2\n00:00:07,000 --> 00:00:09,000\nCaption after seek\n\n");
    fs.writeFileSync(sup, pgsSample());
    const ffmpeg = require("ffmpeg-static");
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:size=320x180:rate=24", "-i", srt, "-i", sup, "-map", "0:v:0", "-map", "1:0", "-map", "2:0", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-c:s", "copy", "-metadata:s:s:0", "language=eng", "-metadata:s:s:1", "language=eng", "-y", media], { windowsHide: true });
    const file = { name: "captioned.mkv", length: fs.statSync(media).size, offset: 0, createReadStream: range => fs.createReadStream(media, range) };
    const { base, service } = await fixture(t, file);
    const info = await service.inspectMedia(0);
    assert.equal(info.subtitles.length, 2);
    assert.equal(info.subtitles[0].kind, "text");
    assert.equal(info.subtitles[1].kind, "bitmap");
    const response = await fetch(`${base}/subtitles?hash=test&file=0&subtitle=${info.subtitles[0].index}&start=6`);
    assert.equal(response.status, 200);
    const cues = parseSubtitleCues(await response.text());
    const cue = cues.find(cue => cue.text === "Caption after seek");
    assert.ok(cue, JSON.stringify(cues));
    assert.ok(Math.abs(cue.start - 7) < 0.1, JSON.stringify(cue));
    for (const seek of [false, true]) {
    const decoder = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", `${base}/transcode?hash=test&file=0&subtitle=${info.subtitles[1].index}&start=${seek ? 2 : 0}`, "-ss", seek ? "0" : "2", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    t.after(() => decoder.kill());
    const chunks = []; let errors = "";
    decoder.stdout.on("data", chunk => chunks.push(chunk)); decoder.stderr.on("data", chunk => { errors += chunk; });
    const [code] = await once(decoder, "close");
    assert.equal(code, 0, errors);
    const pixels = Buffer.concat(chunks);
    assert.equal(pixels.length, 320 * 180 * 3);
    assert.ok(pixels[(22 * 320 + 22) * 3] > 180, "PGS caption must be visibly burned into the decoded frame");
    assert.ok(pixels[0] < 30);
    }
    const invalid = await fetch(`${base}/subtitles?hash=test&file=0&subtitle=999&start=0`);
    assert.equal(invalid.status, 422);
});

test("subtitle discovery and WebVTT parsing preserve language, markup safety and timestamps", () => {
    const tracks = subtitleStreams("  Stream #0:2(eng): Subtitle: subrip (default)\n    Metadata:\n      title : English captions\n  Stream #0:3(jpn): Subtitle: hdmv_pgs_subtitle\n");
    assert.equal(tracks[0].language, "eng"); assert.equal(tracks[0].default, true);
    assert.equal(tracks[1].kind, "bitmap");
    assert.deepEqual(parseSubtitleCues("WEBVTT\n\n00:01.000 --> 00:03.000\n<i>Hi</i> &amp; hello\n\n", 90), [{ start: 91, end: 93, text: "Hi & hello" }]);
});
