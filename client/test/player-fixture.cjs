const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { formatTorrentSpeed } = require("../src/js/torrent-links");
async function playerFixture(options = {}) {
    const handlers = {}, elements = new Map(), timers = new Map(), sources = [];
    let bufferEnd = 0, now = 1000;
    const video = { currentTime: 0, duration: 100, readyState: 0, paused: true, ended: false, seeking: false, videoWidth: 0,
        buffered: { get length() { return bufferEnd > 0 ? 1 : 0; }, start: () => 0, end: () => bufferEnd },
        addEventListener(name, fn) { handlers[name] = fn; }, pause() { this.paused = true; }, async play() { this.paused = false; },
        load() { sources.push(this.src); this.currentTime = 0; this.readyState = 0; this.videoWidth = 0; this.paused = true; bufferEnd = 0; } };
    const element = id => {
        if (id === "video") return video;
        if (!elements.has(id)) elements.set(id, { textContent: "", hidden: true, dataset: {}, addEventListener() {} });
        return elements.get(id);
    };
    const context = { document: { getElementById: element }, window: { addEventListener() {} }, URL, URLSearchParams, AbortSignal, formatTorrentSpeed,
        Date: { now: () => now }, location: { href: "http://127.0.0.1/token/player?hash=test&file=0", search: "?hash=test&file=0" },
        setInterval: (fn, delay) => { timers.set(delay, fn); return delay; }, clearInterval: id => timers.delete(id),
        fetch: async url => String(url).includes("media-info") ? { ok: true, json: async () => ({ duration: 100, requiresCompatibility: Boolean(options.compatibility) }) } : options.fetchStatus ? options.fetchStatus() : { ok: true, status: 200, json: async () => ({ peers: 1, downloadSpeed: 100000, files: [] }) } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/js/torrent-player.js"), "utf8"), context);
    await new Promise(resolve => setImmediate(resolve));
    return { player: context.window.watchPartyPlayer, video, sources, timers, element,
        advance: ms => { now += ms; }, tick: () => timers.get(250)(),
        buffer(seconds) { bufferEnd = seconds; video.readyState = 4; video.videoWidth = 320; handlers.progress(); },
        canplay: () => handlers.canplay() };
}
module.exports = { playerFixture };
