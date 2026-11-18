const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const { parseTorrentLink, formatTorrentSpeed } = require("../src/js/torrent-links");
function fixture(api = {}) {
    class Element {
        constructor() { this.value = ""; this.disabled = false; this.hidden = false; this.dataset = {}; this.options = []; this.handlers = {}; this.textContent = ""; }
        addEventListener(name, fn) { this.handlers[name] = fn; }
        replaceChildren() { this.options = []; this.value = ""; }
        append(option) { this.options.push(option); if (this.options.length === 1) this.value = option.value; }
        get selectedOptions() { return this.options.filter(option => option.value === this.value); }
    }
    const elements = new Map();
    const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
    const context = { document: { getElementById: get, createElement: () => new Element() }, window: { watchParty: { prepareTorrent: async () => metadata, stopTorrent: async () => {}, ...api }, addEventListener() {} },
        canControlPlayer: () => true, setBrowserSite() {}, parseTorrentLink, formatTorrentSpeed, URL, setInterval() {}, clearInterval() {}, openPlayerFromUrl() {}, addQueueFromUrl() {} };
    vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/js/torrent-panel.js"), "utf8"), context);
    return { context, get };
}
const metadata = { ok: true, hash: "a".repeat(40), magnet: `magnet:?xt=urn:btih:${"a".repeat(40)}`, preferredFileIndex: 0, progress: .01,
    files: [{ index: 0, name: "Episode 01 Ocean.mkv", length: 100, downloaded: 50 }, { index: 1, name: "Episode 02 Forest.mkv", length: 1000, downloaded: 0 }] };

test("progress belongs to the selected video and permissions update without reloading", () => {
    const { context, get } = fixture();
    context.displayTorrent(metadata);
    assert.equal(get("torrentCached").textContent, "50%");
    assert.equal(get("torrentProgress").value, 50);
    context.canControlPlayer = () => false; context.refreshTorrentControls();
    assert.equal(get("playTorrent").disabled, true); assert.equal(get("queueTorrent").disabled, false);
    context.canControlPlayer = () => true; context.refreshTorrentControls(); assert.equal(get("playTorrent").disabled, false);
});
test("stopping during metadata loading ignores its stale completion", async () => {
    let finish;
    const { context, get } = fixture({ prepareTorrent: () => new Promise(resolve => { finish = resolve; }) });
    get("torrentMagnet").value = metadata.magnet;
    const loading = context.prepareTorrentPanel(false);
    await get("stopTorrent").onclick(); finish(metadata); await loading;
    assert.equal(get("torrentLibrary").hidden, true); assert.equal(get("playTorrent").disabled, true);
    assert.equal(get("torrentBadge").textContent, "Stopped");
});
test("a stale file preparation cannot overwrite the latest selected video", async () => {
    const pending = [];
    const { context, get } = fixture({ prepareTorrent: () => new Promise(resolve => pending.push(resolve)) });
    context.displayTorrent(metadata);
    get("torrentFile").value = "1"; const first = context.prepareTorrentSelection();
    get("torrentFile").value = "0"; const second = context.prepareTorrentSelection();
    pending[1](metadata); await second;
    pending[0]({ ...metadata, preferredFileIndex: 1, files: metadata.files.map(file => ({ ...file, downloaded: 0 })) }); await first;
    assert.equal(get("torrentCached").textContent, "50%"); assert.equal(get("playTorrent").disabled, false);
});
test("search without results disables playback and clearing the filter restores videos", () => {
    const { context, get } = fixture(); context.displayTorrent(metadata);
    get("torrentSearch").value = "missing"; context.renderTorrentFiles();
    assert.equal(get("torrentFile").disabled, true); assert.equal(get("playTorrent").disabled, true);
    get("torrentSearch").value = ""; context.renderTorrentFiles(); assert.equal(get("torrentFile").options.length, 2);
});
