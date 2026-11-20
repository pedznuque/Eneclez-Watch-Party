const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { parseTorrentLink } = require("../client/src/js/torrent-links");

// One torrent engine per hash, shared by every HTTP viewer. The administrative
// key stays on the room server; random, expiring stream capabilities reach apps.
function createCloudCache({ apiKey, publicOrigin, cachePath, serviceFactory, maxTorrents = 3, maxBytes = 30 * 1024 ** 3, idleMs = 60 * 60 * 1000, maxStreams = 12 }) {
    if (!apiKey || apiKey.length < 32) throw new Error("CLOUD_CACHE_KEY must contain at least 32 characters");
    const origin = new URL(publicOrigin);
    if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Set CLOUD_CACHE_PUBLIC_URL to the worker's public HTTP(S) origin");
    if (![maxTorrents, maxBytes, idleMs, maxStreams].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("Invalid cloud cache limits");
    const app = express(), entries = new Map(), capabilities = new Map();
    const root = path.resolve(cachePath);
    const reservations = new Map(), deleting = new Set();
    let closed = false;
    async function deleteFiles(hash) {
        const target = path.resolve(root, hash);
        if (path.dirname(target) !== root || !/^[a-f0-9]{40}$/.test(hash)) throw new Error("Invalid cache path");
        deleting.add(hash);
        try { await fs.rm(target, { recursive:true, force:true }); reservations.delete(hash); }
        finally { deleting.delete(hash); }
    }
    const diskReady = (async () => {
        await fs.mkdir(root,{recursive:true});
        for (const item of await fs.readdir(root,{withFileTypes:true})) {
            if (!item.isDirectory() || !/^[a-f0-9]{40}$/.test(item.name)) continue;
            const record = await fs.readFile(path.join(root,item.name,".reservation.json"),"utf8").then(JSON.parse).catch(() => null);
            if (!record || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || !Number.isFinite(record.touched) || Date.now()-record.touched > idleMs) await deleteFiles(item.name);
            else reservations.set(item.name,record);
        }
    })();
    diskReady.catch(() => {});
    async function save(entry) {
        await fs.mkdir(path.join(root,entry.hash),{recursive:true});
        await fs.writeFile(path.join(root,entry.hash,".reservation.json"),JSON.stringify({bytes:entry.bytes,touched:entry.touched}));
    }
    app.disable("x-powered-by");
    app.use((_req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Cache-Control", "no-store"); next(); });
    app.get("/health", (_req, res) => res.json({ ok: true, service: "watch-party-cloud-cache" }));
    app.use("/api", (req, res, next) => {
        const received = Buffer.from(req.headers.authorization || "");
        const expected = Buffer.from(`Bearer ${apiKey}`);
        if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return res.status(401).json({ ok:false, error:"Cloud authorization required" });
        next();
    }, express.json({ limit:"8kb" }));
    async function remove(entry) {
        entry.closing = true; capabilities.delete(entry.capability);
        await entry.ready.catch(() => {});
        try { await entry.service.destroy(); await deleteFiles(entry.hash); }
        finally { entries.delete(entry.hash); }
    }
    async function sweep() {
        await diskReady;
        for (const entry of entries.values()) {
            if (!entry.closing && !entry.active && !entry.pending && Date.now() - entry.touched > idleMs) await remove(entry);
        }
        for (const [hash,record] of reservations) if (!entries.has(hash) && !deleting.has(hash) && Date.now()-record.touched>idleMs) await deleteFiles(hash);
    }
    app.post("/api/torrents", async (req, res) => {
        const parsed = parseTorrentLink(req.body?.magnet);
        const fileIndex = req.body?.fileIndex ?? parsed?.fileIndex;
        if (!parsed || (fileIndex !== null && fileIndex !== undefined && (!Number.isSafeInteger(fileIndex) || fileIndex < 0 || fileIndex > 99999))) return res.status(400).json({ ok:false, error:"Invalid torrent or file index" });
        // Canonicalize base32 aliases so one swarm cannot allocate two caches.
        const hash = parsed.hash.length === 40 ? parsed.hash : base32Hash(parsed.hash);
        let entry;
        try {
            await diskReady;
            if (closed) throw new Error("Cloud cache is shutting down");
            entry = entries.get(hash);
            if (entry?.closing || deleting.has(hash)) return res.status(503).json({ok:false,error:"This cache is expiring. Retry shortly."});
            if (!entry) {
                // Admission is synchronous: concurrent requests cannot overbook
                // the worker while metadata is pending.
                if (entries.size >= maxTorrents) return res.status(503).json({ ok:false, error:"Cloud cache is full. Try again after an idle torrent expires." });
                entry = { hash, capability:crypto.randomBytes(24).toString("hex"), touched:Date.now(), active:0, pending:true, bytes:0 };
                entry.service = serviceFactory(path.join(root, hash));
                entries.set(hash, entry); capabilities.set(entry.capability, entry);
                // Do not let magnets cause server-side HTTP requests to supplied
                // web seeds, metadata URLs, or arbitrary tracker URLs. DHT
                // discovers public peers instead.
                entry.ready = Promise.resolve().then(() => entry.service.prepare(`magnet:?xt=urn:btih:${hash}`)).then(async metadata => {
                    entry.bytes = entry.service.current.length;
                    reservations.set(hash,{bytes:entry.bytes,touched:entry.touched});
                    const reserved = [...reservations.values()].reduce((sum, item) => sum + item.bytes, 0);
                    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || reserved > maxBytes) throw new Error("This torrent exceeds the cloud cache storage limit. Choose a smaller torrent.");
                    await save(entry);
                    entry.pending = false;
                    return metadata;
                });
            }
            entry.touched = Date.now();
            await entry.ready;
            if (closed || entries.get(hash) !== entry) throw new Error("Cloud cache expired. Load the torrent again.");
            if (fileIndex !== null && fileIndex !== undefined) entry.service.player(fileIndex);
            const metadata = entry.service.describe();
            const base = `${origin.origin}/cache/${entry.capability}/`;
            const query = `?hash=${hash}&file=${fileIndex ?? metadata.preferredFileIndex ?? 0}`;
            res.json({ ok:true, ...metadata, conversionError:"", cloud:true, playerUrl:fileIndex == null ? null : `${base}player${query}`, statusUrl:`${base}status${query}` });
        } catch (error) {
            if (entry?.pending) { entry.pending = false; await remove(entry).catch(() => {}); }
            res.status(502).json({ ok:false, error:error.message });
        }
    });
    const routes = new Set(["player", "torrent-player.js", "torrent-links.js", "torrent-subtitles.js", "status", "media-info", "stream", "transcode", "subtitles"]);
    app.use("/cache/:capability/:route", (req, res) => {
        const entry = capabilities.get(req.params.capability), route = req.params.route;
        if (!entry || !routes.has(route) || !["GET", "HEAD"].includes(req.method)) return res.status(404).end();
        if (entry.pending) return res.status(503).end();
        if (entry.active >= maxStreams) return res.status(429).end("Too many cloud streams. Retry shortly.");
        entry.touched = Date.now(); entry.active++;
        let finished = false;
        const release = () => { if (!finished) { finished = true; entry.active--; entry.touched = Date.now(); } };
        res.once("finish", release); res.once("close", release);
        // A failed conversion belongs to that HTTP viewer, not every viewer
        // using this shared torrent. Decoder/request errors stay per player.
        if (route === "status") return res.json({ ...entry.service.describe(), conversionError:"" });
        const query = new URL(req.originalUrl, "http://localhost").search;
        req.url = `/${entry.service.token}/${route}${query}`;
        entry.service.handleRequest(req, res);
    });
    const timer = setInterval(() => sweep().catch(() => {}), Math.min(idleMs, 60000)); timer.unref();
    return { app, entries, sweep, async close() { closed = true; clearInterval(timer); await diskReady; await Promise.all([...entries.values()].map(async entry => { await entry.ready.catch(() => {}); if (entry.bytes && !entry.pending) await save(entry); await entry.service.destroy(); })); entries.clear(); capabilities.clear(); } };
}
function base32Hash(value) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
    let bits = 0, accumulator = 0, result = "";
    for (const letter of value) {
        accumulator = (accumulator << 5) | alphabet.indexOf(letter); bits += 5;
        if (bits >= 8) { bits -= 8; result += ((accumulator >>> bits) & 255).toString(16).padStart(2,"0"); }
    }
    return result;
}
module.exports = { createCloudCache, base32Hash };
