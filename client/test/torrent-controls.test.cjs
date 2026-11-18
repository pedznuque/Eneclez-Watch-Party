const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseTorrentLink, formatTorrentSpeed } = require("../src/js/torrent-links.js");
const source = fs.readFileSync(path.join(__dirname, "../src/js/room.js"), "utf8").replace(/\r\n/g, "\n");
const loadSource = source.slice(source.indexOf("async function loadPlayerWebviewUrl("), source.indexOf("function loadDriveFallbackPlayer("));
const controlsSource = source.slice(source.indexOf("function updateHostControls("), source.indexOf("async function readPlaybackState("));

for (const role of ["host", "controller", "guest"]) {
    test(`delayed torrent preparation refreshes ${role} controls`, async () => {
        let finish;
        const metadata = new Promise(resolve => { finish = resolve; });
        const controls = Array.from({ length: 4 }, () => ({ disabled: false }));
        const context = {
            torrentLoadGeneration: 0, parseTorrentLink, torrentPlayerLinks: new Map(),
            window: { watchParty: { prepareTorrent: () => metadata } },
            playerPane: { classList: { remove() {}, toggle() {} } }, playerWebview: { src: "about:blank" },
            restoreDriveBrowserToBrowserPane() {}, clearPlayerError() {}, setPlayerEmptyState() {}, setPlayerLoading() {},
            setPlayerError: message => { throw new Error(message); },
            isHostUser: () => role === "host", canControlPlayer: () => role !== "guest", currentHost: "host",
            hostBadgeEl: {}, playPauseButton: controls[0], stopPlayerButton: controls[1], playbackProgressEl: controls[2], qualitySelectEl: controls[3]
        };
        vm.createContext(context);
        vm.runInContext(controlsSource + "\n" + loadSource, context);
        context.updateHostControls();
        assert.ok(controls.every(control => control.disabled));
        const loading = context.loadPlayerWebviewUrl(`magnet:?xt=urn:btih:${"a".repeat(40)}&wpFile=0`);
        assert.equal(context.playerWebview.src, "about:blank");
        finish({ ok: true, playerUrl: "http://127.0.0.1:1234/token/player?hash=test&file=0" });
        await loading;
        assert.ok(controls.every(control => control.disabled === (role === "guest")), "host/controller controls must unlock when the async player URL is assigned");
        assert.equal(context.torrentPlayerLinks.size, 1);
    });
}

test("pause intent survives buffering and delayed canplay events", async () => {
    const handlers = {};
    const video = { readyState: 0, currentTime: 10, duration: 100, paused: false, buffered: { length: 0 },
        addEventListener(name, handler) { handlers[name] = handler; }, pause() { this.paused = true; },
        async play() { this.paused = false; } };
    const context = { document: { getElementById: id => id === "video" ? video : {} },
        window: { addEventListener() {} }, location: { href: "http://127.0.0.1/token/player?hash=test&file=0", search: "?hash=test&file=0" },
        URL, URLSearchParams, Date, setInterval() {}, clearInterval() {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/js/torrent-player.js"), "utf8"), context);
    const player = context.window.watchPartyPlayer;
    await player.setPaused(true);
    assert.equal(player.getState().paused, true);
    assert.equal(video.paused, true, "pause must cancel play intent immediately, even before metadata arrives");
    video.readyState = 3;
    handlers.canplay();
    assert.equal(video.paused, true, "metadata/canplay must respect a pause requested during buffering");
    await player.setPaused(false);
    assert.equal(video.paused, false);
    await player.setPaused(true);
    handlers.canplay();
    assert.equal(video.paused, true);
});

test("speed display distinguishes bytes per second from megabits per second", () => {
    assert.equal(formatTorrentSpeed(520000), "520 KB/s (4.16 Mbps)");
    assert.equal(formatTorrentSpeed(2000000), "2.00 MB/s (16.00 Mbps)");
    assert.equal(formatTorrentSpeed(-1), "0 KB/s (0.00 Mbps)");
});
