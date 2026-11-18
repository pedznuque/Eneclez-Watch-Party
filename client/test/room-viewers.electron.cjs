// Run with: electron test/room-viewers.electron.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), os = require("os"), path = require("path"), vm = require("vm");
const assert = require("assert/strict");
const { createRequire } = require("module");
const { once } = require("events");
const { execFileSync } = require("child_process");
const { TorrentService } = require("../torrent-service.cjs");
const { parseTorrentLink } = require("../src/js/torrent-links");
const { io } = require("../../server/node_modules/socket.io/client-dist/socket.io.js");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "watchparty-room-viewers-"));
// The parent runner removes this directory after Electron releases its cache.
if (process.env.WATCH_PARTY_TEST_TEMP_FILE) fs.writeFileSync(process.env.WATCH_PARTY_TEST_TEMP_FILE, temp);
app.setPath("userData", path.join(temp, "userData"));
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.on("window-all-closed", () => {});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, timeout = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeout) { if (await fn()) return; await sleep(100); }
    throw new Error(`Timed out: ${label}`);
}
let server, seed, heartbeat;
const viewers = [], failures = [];
app.whenReady().then(async () => {
    try {
        const srt = path.join(temp, "captions.srt"), movie = path.join(temp, "shared.mkv");
        fs.writeFileSync(srt, "1\n00:00:01,000 --> 00:00:29,000\nShared captions\n\n");
        execFileSync(require("ffmpeg-static"), ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-i", srt, "-t", "30", "-map", "0:v:0", "-map", "1:0", "-c:v", "libx264", "-preset", "ultrafast", "-c:s", "srt", "-metadata:s:s:0", "language=eng", "-y", movie], { windowsHide: true });
        const serverDir = path.resolve(__dirname, "../../server");
        server = new Function("require", "__dirname", "process", fs.readFileSync(path.join(serverDir, "server.js"), "utf8") + "\nreturn server;")(
            createRequire(path.join(serverDir, "server.js")), serverDir, { env: { ...process.env, PORT: "0" } });
        if (!server.listening) await once(server, "listening");
        const origin = `http://127.0.0.1:${server.address().port}`;
        const options = { utp: false, dht: false, tracker: false, lsd: false, natUpnp: false, natPmp: false };
        const { default: WebTorrent } = await import("webtorrent");
        seed = new WebTorrent(options);
        const torrent = await new Promise(resolve => seed.seed(movie, { announce: [] }, resolve));
        const magnet = `${torrent.magnetURI}&wpFile=0`;
        const roomSource = fs.readFileSync(path.join(__dirname, "../src/js/room.js"), "utf8").replace(/\r\n/g, "\n");
        const syncSource = roomSource.slice(roomSource.indexOf("function playbackClockNow("), roomSource.indexOf("function schedulePlayerWebviewSizeSync("));
        const applySource = roomSource.slice(roomSource.indexOf("async function applyPlaybackState("), roomSource.indexOf("async function emitHostPlaybackState("));
        async function makeViewer(username, delay = 0) {
            const viewer = { username, service: new TorrentService(path.join(temp, username), options), loaded: false, lastState: null };
            viewers.push(viewer);
            viewer.window = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
            viewer.context = { username, applyingRemotePlayback: false, Date, performance: { now: () => Date.now() },
                playerWebview: { executeJavaScript: code => viewer.window.webContents.executeJavaScript(code) }, applyPlayerVolume: async () => {}, selectedVolume: 80 };
            vm.createContext(viewer.context); vm.runInContext(syncSource + "\n" + applySource, viewer.context);
            viewer.read = () => viewer.window.webContents.executeJavaScript("window.watchPartyPlayer?.getState()");
            viewer.socket = io(origin, { transports: ["websocket"], forceNew: true });
            viewer.socket.on("mediaPlayback", state => {
                viewer.lastState = viewer.context.withLocalSyncState(state);
                if (viewer.loaded) viewer.context.applyPlaybackState(viewer.lastState).catch(error => failures.push(error));
            });
            viewer.socket.on("mediaLoaded", media => {
                (async () => {
                    assert.equal(media.url, magnet, "the room must share the magnet/file index, never another viewer's localhost URL");
                    const parsed = parseTorrentLink(media.url);
                    await sleep(delay);
                    const preparing = viewer.service.prepare(media.url);
                    await until(() => viewer.service.current, "torrent created for metadata exchange");
                    viewer.service.current.addPeer(`127.0.0.1:${seed.torrentPort}`);
                    await preparing;
                    const url = viewer.service.player(parsed.fileIndex);
                    viewer.playerUrl = url;
                    await viewer.window.loadURL(url);
                    await until(async () => (await viewer.read())?.ready, `${username} playback ready`);
                    viewer.loaded = true;
                    if (viewer.lastState) await viewer.context.applyPlaybackState(viewer.lastState);
                })().catch(error => failures.push(error));
            });
            await once(viewer.socket, "connect");
            const users = once(viewer.socket, "roomUsers");
            viewer.socket.emit("joinRoom", { room: "two-viewer-test", username, create: username === "host" });
            await users;
            return viewer;
        }
        const host = await makeViewer("host");
        const shared = await new Promise(resolve => host.socket.emit("loadMedia", { room: "two-viewer-test", username: "host", url: magnet, title: "Generated caption test" }, resolve));
        assert.equal(shared.ok, true);
        await until(async () => host.loaded && (await host.read()).currentTime > 1, "host playback");
        heartbeat = setInterval(async () => {
            try {
                if (!host.loaded || host.context.applyingRemotePlayback) return;
                const state = await host.read();
                if (!state?.ready || state.seeking || state.buffering || host.context.applyingRemotePlayback) return;
                host.socket.emit("mediaControl", { room: "two-viewer-test", ...state });
            } catch (error) { failures.push(error); }
        }, 3000);
        const guest = await makeViewer("guest", 1500);
        await until(async () => guest.loaded && (await guest.read()).currentTime > 1, "late guest playback");
        assert.notEqual(host.playerUrl, guest.playerUrl, "each viewer requires an independent local service");
        await until(async () => {
            const a = await host.read(), b = await guest.read();
            return a.ready && b.ready && Math.abs(a.currentTime - b.currentTime) < 1.5;
        }, "late join synchronized");
        await until(async () => (await Promise.all(viewers.map(viewer => viewer.window.webContents.executeJavaScript("document.getElementById('subtitleText').textContent")))).every(text => text.includes("Shared captions")), "captions visible on both viewers");
        console.log("PASS independent local torrent services, delayed metadata exchange, late join, and visible captions on both viewers");
        async function control(viewer, expression) {
            await viewer.window.webContents.executeJavaScript(expression);
            viewer.socket.emit("mediaControl", { room: "two-viewer-test", ...await viewer.read() });
        }
        await control(host, "window.watchPartyPlayer.setPaused(true)");
        await until(async () => (await guest.read()).paused, "guest follows pause");
        const paused = (await guest.read()).currentTime;
        await sleep(1000);
        assert.ok(Math.abs((await guest.read()).currentTime - paused) < 0.15);
        assert.equal(await guest.window.webContents.executeJavaScript("document.getElementById('video').paused"), true);
        await control(host, "window.watchPartyPlayer.seekTo(12, false)");
        await until(async () => { const state = await guest.read(); return state.paused && Math.abs(state.currentTime - 12) < 0.3; }, "guest follows paused seek");
        await control(host, "window.watchPartyPlayer.setPaused(false)");
        await until(async () => (await guest.read()).currentTime > 12.4 && !(await guest.read()).paused, "guest follows resume");
        console.log("PASS host pause, paused forward seek, and resume on second viewer");
        const grant = await new Promise(resolve => host.socket.emit("setController", { room: "two-viewer-test", target: "guest", allowed: true }, resolve));
        assert.equal(grant.ok, true);
        await control(guest, "window.watchPartyPlayer.seekTo(18, false)");
        await until(async () => { const state = await host.read(); return state.paused && Math.abs(state.currentTime - 18) < 0.3; }, "host follows granted guest");
        console.log("PASS authorized guest control synchronizes back to the host");
        assert.equal(failures.length, 0, failures.map(error => error.stack).join("\n"));
    } catch (error) { console.error(error.stack); process.exitCode = 1; }
    finally {
        clearInterval(heartbeat);
        for (const viewer of viewers) { viewer.socket?.disconnect(); viewer.window?.destroy(); await viewer.service.destroy(); }
        if (seed) await new Promise(resolve => seed.destroy(resolve));
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        app.exit(process.exitCode || 0);
    }
});
