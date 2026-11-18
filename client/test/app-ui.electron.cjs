const { app, BrowserWindow, ipcMain, webContents, session } = require("electron");
const fs = require("fs"), os = require("os"), path = require("path");
const assert = require("assert/strict");
const { createRequire } = require("module");
const { once } = require("events");
const { execFileSync } = require("child_process");
const { TorrentService } = require("../torrent-service.cjs");
const { io: connect } = require("../../server/node_modules/socket.io/client-dist/socket.io.js");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "watchparty-app-ui-"));
const src = path.resolve(__dirname, "../src");
const roomPage = path.join(src, ".tmp-app-ui-room.html");
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
let win, server, seed, service;
const clients = [];
app.whenReady().then(async () => {
    try {
        const serverDir = path.resolve(__dirname, "../../server");
        server = new Function("require", "__dirname", "process", fs.readFileSync(path.join(serverDir, "server.js"), "utf8") + "\nreturn server;")(
            createRequire(path.join(serverDir, "server.js")), serverDir, { env: { ...process.env, PORT: "0" } });
        if (!server.listening) await once(server, "listening");
        const origin = `http://127.0.0.1:${server.address().port}`;
        const mediaDir = path.join(temp, "Shared video collection"); fs.mkdirSync(mediaDir);
        const english = path.join(temp, "english.srt"), spanish = path.join(temp, "spanish.srt");
        fs.writeFileSync(english, "1\n00:00:00,000 --> 00:00:28,000\nEnglish captions\n\n");
        fs.writeFileSync(spanish, "1\n00:00:00,000 --> 00:00:28,000\nSubtitulos de prueba\n\n");
        const movie = path.join(mediaDir, "Episode 01 - Ocean.mkv");
        execFileSync(require("ffmpeg-static"), ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-i", english, "-i", spanish, "-t", "30", "-map", "0:v:0", "-map", "1:0", "-map", "2:0", "-c:v", "libx264", "-preset", "ultrafast", "-c:s", "srt", "-metadata:s:s:0", "language=eng", "-metadata:s:s:1", "language=spa", "-y", movie], { windowsHide: true });
        fs.copyFileSync(movie, path.join(mediaDir, "Episode 02 - Forest.mkv"));
        const { default: WebTorrent } = await import("webtorrent");
        const options = { utp: false, dht: false, tracker: false, lsd: false, natUpnp: false, natPmp: false };
        seed = new WebTorrent(options);
        const torrent = await new Promise(resolve => seed.seed(mediaDir, { announce: [] }, resolve));
        service = new TorrentService(path.join(temp, "cache"), options);
        let prepareTask = Promise.resolve();
        const prepare = request => {
            const task = prepareTask.then(async () => {
                const result = service.prepare(request.magnet);
                await until(() => service.current, "local torrent created");
                service.current.addPeer(`127.0.0.1:${seed.torrentPort}`);
                const metadata = await result;
                return { ok: true, ...metadata, playerUrl: Number.isInteger(request.fileIndex) ? service.player(request.fileIndex) : null };
            });
            prepareTask = task.catch(() => {});
            return task;
        };
        ipcMain.on("watch-party-server-origin", event => { event.returnValue = origin; });
        ipcMain.on("watch-party-chat-focus", () => {});
        ipcMain.on("watch-party-chat-focus-clear", () => {});
        ipcMain.handle("watch-party-torrent", (_event, request) => prepare(request));
        ipcMain.handle("watch-party-torrent-file", async () => ({ ok: true, ...await service.prepare(torrent.torrentFile) }));
        ipcMain.handle("watch-party-torrent-status", () => { try { return { ok: true, ...service.describe() }; } catch { return { ok: false }; } });
        ipcMain.handle("watch-party-torrent-stop", async () => { await service.stop(); return { ok: true }; });
        ipcMain.handle("watch-party-get-app-info", () => ({ version: require("../package.json").version, isPackaged: false }));
        ipcMain.handle("watch-party-check-for-updates", () => { throw new Error("Simulated offline update check"); });
        ipcMain.handle("watch-party-clear-cache", () => ({ message: "Test cache cleared" }));
        ipcMain.handle("watch-party-get-drive-media-url", () => null);
        const errorsScript = '<script>window.__appErrors=[];window.addEventListener("error",e=>window.__appErrors.push(e.message));window.addEventListener("unhandledrejection",e=>window.__appErrors.push(String(e.reason)));</script>';
        const roomHtml = fs.readFileSync(path.join(src, "room.html"), "utf8")
            .replace('https://eneclez-watch-party.onrender.com/socket.io/socket.io.js', `${origin}/socket.io/socket.io.js`)
            .replace('src="https://www.bilibili.tv/en"', 'src="about:blank"')
            .replace("<head>", "<head>" + errorsScript);
        fs.writeFileSync(roomPage, roomHtml);
        win = new BrowserWindow({ show: false, width: 1280, height: 1040, webPreferences: { preload: path.resolve(__dirname, "../preload.js"), webviewTag: true, backgroundThrottling: false } });
        const localOnly = (details, callback) => callback({ cancel: /^https?:/.test(details.url) && !details.url.startsWith("http://127.0.0.1:") });
        win.webContents.session.webRequest.onBeforeRequest(localOnly);
        session.fromPartition("persist:eneclez-browser").webRequest.onBeforeRequest(localOnly);
        win.webContents.on("will-navigate", (event, url) => {
            const parsed = new URL(url);
            if (parsed.pathname.endsWith("/room.html")) { event.preventDefault(); win.loadFile(roomPage, { search: parsed.search }); }
        });
        await win.loadFile(path.join(src, "index.html"));
        const run = code => win.webContents.executeJavaScript(code);
        await run("document.getElementById('settingsOpen').click(); document.getElementById('settingsUpdateCheck').click()");
        await until(async () => await run("!document.getElementById('settingsUpdateCheck').disabled && document.getElementById('settingsUpdateStatus').textContent.includes('Could not')"), "failed update check recovers");
        await run("document.getElementById('settingsClearCache').click()");
        await until(async () => await run("document.getElementById('settingsCacheStatus').textContent.includes('Test cache cleared')"), "settings cache action");
        await run("document.getElementById('settingsClose').click();document.getElementById('username').value='UI Host';document.getElementById('create').click()");
        await until(async () => win.webContents.getURL().includes(".tmp-app-ui-room.html") && await run("window.roomHasJoined === true || (typeof roomHasJoined !== 'undefined' && roomHasJoined)"), "lobby creates and joins room");
        console.log("PASS lobby create/join, settings error recovery, and cache action");
        const room = await run("roomCode");
        const socket = connect(origin, { transports: ["websocket"], forceNew: true }); clients.push(socket); await once(socket, "connect");
        const joined = once(socket, "roomUsers"); socket.emit("joinRoom", { room, username: "UI Guest" }); await joined;
        await run("document.getElementById('message').value='UI chat test';document.getElementById('send').click()");
        await until(async () => await run("document.getElementById('messages').textContent.includes('UI chat test')"), "chat send and render");
        for (const provider of ["Youtube", "Facebook", "Drive", "Torrent"]) {
            await run(`document.getElementById('browse${provider}').click()`);
            assert.equal(await run(`document.getElementById('browse${provider}').classList.contains('is-active')`), true);
        }
        await run(`document.getElementById('torrentMagnet').value=${JSON.stringify(torrent.magnetURI)}; document.getElementById('loadTorrent').click()`);
        await until(async () => await run("document.getElementById('torrentFile').options.length===2 && !document.getElementById('playTorrent').disabled"), "torrent file list and host controls");
        await run("document.getElementById('torrentSearch').value='Ocean';document.getElementById('torrentSearch').dispatchEvent(new Event('input'))");
        await until(async () => await run("document.getElementById('torrentFile').options.length===1 && !document.getElementById('playTorrent').disabled"), "video search and prepare");
        await run("document.getElementById('queueTorrent').click()");
        await until(async () => await run("queueItems.length===1"), "queue add");
        console.log("PASS chat, provider tabs, torrent loading/search, and queue add");
        await run("document.getElementById('playTorrent').click()");
        await until(async () => await run("playerPane.classList.contains('is-torrent-player') && getComputedStyle(playerWebview).pointerEvents==='auto'"), "torrent webview accepts clicks");
        const guestContents = webContents.fromId(await run("playerWebview.getWebContentsId()"));
        const player = code => guestContents.executeJavaScript(code);
        await until(async () => await player("window.watchPartyPlayer?.getState().ready && document.getElementById('subtitleSelect').options.length===3"), "embedded subtitle menu ready");
        await run("document.getElementById('playPause').click()");
        await until(async () => (await player("window.watchPartyPlayer.getState()")).paused, "pause before pointer test");
        await run("document.activeElement?.blur(); playerWebview.scrollIntoView({block:'center'})");
        await sleep(200);
        const pane = await run("(()=>{const r=playerWebview.getBoundingClientRect();return {x:r.x,y:r.y}})()");
        const select = await player("(()=>{const r=document.getElementById('subtitleSelect').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
        console.log("Pointer geometry", JSON.stringify({ pane, select, hit: await run(`document.elementsFromPoint(${pane.x + select.x},${pane.y + select.y}).map(e=>e.id||e.tagName)`), child: await player(`document.elementFromPoint(${select.x},${select.y})?.id`) }));
        fs.mkdirSync(path.resolve(__dirname, "../test-artifacts"), { recursive: true });
        fs.writeFileSync(path.resolve(__dirname, "../test-artifacts/pointer-debug.png"), (await win.webContents.capturePage()).toPNG());
        win.webContents.debugger.attach("1.3");
        for (const type of ["mousePressed", "mouseReleased"]) await win.webContents.debugger.sendCommand("Input.dispatchMouseEvent", { type, x: pane.x + select.x, y: pane.y + select.y, button: "left", clickCount: 1 });
        await until(async () => await player("document.activeElement.id==='subtitleSelect'"), "real pointer reaches embedded subtitle selector", 5000);
        await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await player("document.getElementById('subtitleSelect').value='off';document.getElementById('subtitleSelect').dispatchEvent(new Event('change'))");
        await until(async () => await player("document.getElementById('subtitleText').hidden"), "subtitles off");
        await player("(()=>{const s=document.getElementById('subtitleSelect');s.value=Array.from(s.options).find(o=>o.textContent.startsWith('SPA')).value;s.dispatchEvent(new Event('change'))})()");
        await until(async () => await player("document.getElementById('subtitleText').textContent.includes('Subtitulos de prueba')"), "subtitle language switch");
        await run("document.getElementById('playPause').click()");
        await until(async () => !(await player("window.watchPartyPlayer.getState()")).paused, "resume button");
        await run("document.getElementById('playPause').click()");
        await until(async () => await player("window.watchPartyPlayer.getState().paused && document.getElementById('video').paused"), "pause button");
        await run("playbackProgressEl.value='500';playbackProgressEl.dispatchEvent(new Event('input'));playbackProgressEl.dispatchEvent(new Event('change'))");
        await until(async () => Math.abs((await player("window.watchPartyPlayer.getState()")).currentTime - 15) < 1, "seek slider");
        console.log("PASS full-room native pointer hit test, subtitle Off/language switch, pause, and seek");
        assert.equal(await run("document.getElementById('playingTitle').textContent"), "Episode 01 - Ocean.mkv");
        await win.webContents.executeJavaScript("playerStage.requestFullscreen()", true);
        await until(async () => await run("document.fullscreenElement===playerStage && !document.getElementById('fullscreenControlsToggle').hidden"), "fullscreen controls available");
        await run("document.getElementById('fullscreenControlsToggle').click()");
        await until(async () => await run("playerStage.classList.contains('is-fullscreen-controls-idle') && playerControls.inert"), "fullscreen manual hide");
        await player("document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}))");
        await sleep(400);
        assert.equal(await run("playerStage.classList.contains('is-fullscreen-controls-idle')"), true, "manual Hide must remain hidden on mouse movement");
        await run("document.getElementById('fullscreenControlsToggle').click()");
        await until(async () => await run("!playerStage.classList.contains('is-fullscreen-controls-idle') && !playerControls.inert"), "fullscreen manual show");
        await until(async () => await run("playerStage.classList.contains('is-fullscreen-controls-idle')"), "fullscreen auto-hide", 8000);
        await player("document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}))");
        await until(async () => await run("!playerStage.classList.contains('is-fullscreen-controls-idle')"), "native webview activity reveals controls");
        await run("document.getElementById('fullscreenControlsPin').click()");
        await sleep(2500);
        assert.equal(await run("!playerStage.classList.contains('is-fullscreen-controls-idle') && document.getElementById('fullscreenControlsPin').getAttribute('aria-pressed')==='true'"), true);
        await run("document.getElementById('fullscreenControlsPin').click()");
        await win.webContents.executeJavaScript("document.exitFullscreen()", true);
        await until(async () => await run("!document.fullscreenElement && !playerControls.inert && document.getElementById('fullscreenControlsToggle').hidden"), "fullscreen exit restores normal controls");
        console.log("PASS playing title, fullscreen Hide/Show, auto-hide, native-player wake-up, Keep visible, and exit");
        await run("document.getElementById('torrentSearch').value='';document.getElementById('torrentSearch').dispatchEvent(new Event('input'))");
        await sleep(200);
        await run("(()=>{const panel=document.querySelector('.media-panel');panel.scrollTop+=browserPane.getBoundingClientRect().top-panel.getBoundingClientRect().top-12})()");
        assert.equal(await run("document.getElementById('torrentPanel').getBoundingClientRect().height > 400 && browserPane.clientHeight >= document.getElementById('torrentPanel').offsetHeight"), true, "the full torrent panel must be visible and not clipped by its pane");
        const artifacts = path.resolve(__dirname, "../test-artifacts"); fs.mkdirSync(artifacts, { recursive: true });
        await sleep(300); fs.writeFileSync(path.join(artifacts, "torrent-ui-desktop.png"), (await win.webContents.capturePage()).toPNG());
        win.setSize(760, 1000); await sleep(300);
        await run("document.querySelector('.chat-panel').style.transition='none';document.getElementById('compactChatClose').click();browserPane.scrollIntoView({block:'start'})");
        await until(async () => await run("getComputedStyle(document.querySelector('.chat-panel')).opacity==='0'"), "compact chat closes without covering torrent controls");
        assert.equal(await run("document.getElementById('torrentPanel').getBoundingClientRect().height > 400 && browserPane.clientHeight >= document.getElementById('torrentPanel').offsetHeight"), true, "compact resizing must keep the active torrent browser visible");
        assert.equal(await run("document.getElementById('torrentPanel').scrollWidth <= document.getElementById('torrentPanel').clientWidth + 1"), true, "torrent UI must not overflow horizontally");
        fs.writeFileSync(path.join(artifacts, "torrent-ui-compact.png"), (await win.webContents.capturePage()).toPNG());
        assert.deepEqual(await run("window.__appErrors"), []);
        await run("document.getElementById('stopPlayer').click()");
        await until(async () => await run("playerWebview.src==='about:blank' && !playerPane.classList.contains('is-torrent-player') && document.getElementById('playPause').disabled && document.getElementById('nowPlaying').hidden"), "stop resets player, title and controls");
        console.log("PASS responsive torrent UI, no renderer exceptions, and stop/reset");
    } catch (error) { console.error(error.stack); process.exitCode = 1; }
    finally {
        for (const socket of clients) socket.disconnect();
        if (win && !win.isDestroyed()) win.destroy();
        await service?.destroy();
        if (seed) await new Promise(resolve => seed.destroy(resolve));
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (fs.existsSync(roomPage)) fs.unlinkSync(roomPage);
        app.exit(process.exitCode || 0);
    }
});
