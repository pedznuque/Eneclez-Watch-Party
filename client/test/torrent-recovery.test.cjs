const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { formatTorrentSpeed } = require("../src/js/torrent-links");
const { playerFixture } = require("./player-fixture.cjs");
const tick = () => new Promise(resolve => setImmediate(resolve));
function captions(getMediaInfo) {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { disabled: id === "subtitleSelect", hidden: true, value: id === "subtitleSelect" ? "off" : "", textContent: "", handlers: {}, options: id === "subtitleSelect" ? [{ value: "off" }] : [],
            addEventListener(name, fn) { this.handlers[name] = fn; }, append(option) { this.options.push(option); }, remove(index) { this.options.splice(index, 1); } });
        return elements.get(id);
    };
    const selected = [];
    const player = { getMediaInfo, getState: () => ({ currentTime: 2 }), setSubtitleTrack: async track => selected.push(track) };
    const context = { document: { getElementById: element, createElement: () => ({}) }, window: { watchPartyPlayer: player, addEventListener() {} }, URL, location: { href: "http://127.0.0.1/token/player?hash=test&file=0", search: "?hash=test&file=0" },
        AbortController, TextDecoder, Date, setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }) } }) };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/js/torrent-subtitles.js"), "utf8"), context);
    return { element, selected };
}
const info = { subtitles: [{ index: 2, language: "eng", label: "English", kind: "text" }] };

test("subtitle Off stays usable during metadata loading and a failed search can be retried", async () => {
    let attempts = 0;
    const { element } = captions(async () => { if (++attempts === 1) throw new Error("offline"); return info; });
    assert.equal(element("subtitleSelect").disabled, false);
    await tick();
    assert.equal(element("subtitleRetry").hidden, false);
    await element("subtitleRetry").onclick();
    assert.equal(element("subtitleSelect").options.length, 2);
    assert.equal(element("subtitleRetry").hidden, true);
});
test("an explicit Off choice is not overwritten when late subtitle metadata arrives", async () => {
    let finish;
    const { element, selected } = captions(() => new Promise(resolve => { finish = resolve; }));
    element("subtitleSelect").handlers.change();
    finish(info); await tick();
    assert.equal(element("subtitleSelect").value, "off");
    assert.equal(selected.length, 1); assert.equal(selected[0], null);
});
test("temporary status failures do not stop playback or permanently disable polling", async () => {
    let request = 0;
    const fixture = await playerFixture({ fetchStatus: async () => {
            if (++request <= 3) throw new Error("temporarily offline");
            return request === 5 ? { status: 410 } : { ok: true, status: 200, json: async () => ({ peers: 1, downloadSpeed: 100000, files: [] }) };
        } });
    const poll = fixture.timers.get(1500);
    for (let index = 0; index < 4; index++) await poll();
    assert.equal(fixture.timers.has(1500), true); assert.equal(fixture.player.getState().error, "");
    await poll(); assert.equal(fixture.timers.has(1500), false); assert.match(fixture.player.getState().error, /transfer stopped/i);
});
