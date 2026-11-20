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
        const blockedProviderRequests=[];let mockWebtor=false,liveWebtor=false;
        const localOnly = (details, callback) => {
            const cancel=/^https?:/.test(details.url) && !details.url.startsWith("http://127.0.0.1:") && !liveWebtor && !(mockWebtor&&new URL(details.url).origin==='https://webtor.io');
            if(cancel)blockedProviderRequests.push({url:details.url,webContentsId:details.webContentsId});
            callback({cancel});
        };
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
        const longMessage = "Chat wrapping test " + "X".repeat(900);
        socket.emit("chat", { room, message: longMessage });
        await until(async () => await run("document.getElementById('messages').textContent.includes('Chat wrapping test')"), "long guest message");
        async function assertChatBounds(label) {
            const bounds = await run(`(() => {
                const panel=document.querySelector('.chat-panel'), messages=document.getElementById('messages'), send=document.querySelector('.send');
                const p=panel.getBoundingClientRect(), s=send.getBoundingClientRect();
                return { messagesFit:messages.scrollWidth<=messages.clientWidth+1, composerFits:s.right<=p.right+1 && s.left>=p.left-1, pageFits:document.documentElement.scrollWidth<=innerWidth+1 };
            })()`);
            assert.deepEqual(bounds, { messagesFit:true, composerFits:true, pageFits:true }, label);
        }
        await assertChatBounds("desktop chat and composer stay inside the column with long text");
        for (const provider of ["Youtube", "Facebook", "Drive", "Webtor", "Torrent"]) {
            await run(`document.getElementById('browse${provider}').click()`);
            assert.equal(await run(`document.getElementById('browse${provider}').classList.contains('is-active')`), true);
        }
        const webtorMovie=path.join(temp,'webtor.mp4');
        execFileSync(require('ffmpeg-static'),['-hide_banner','-loglevel','error','-i',movie,'-map','0:v:0','-c:v','copy','-an','-movflags','+faststart','-y',webtorMovie],{windowsHide:true});
        const webtorBytes=fs.readFileSync(webtorMovie),webtorSession=session.fromPartition('persist:eneclez-browser');
        let streamPosts=0;const postOrigins=[];
        await webtorSession.protocol.handle('https',async request=>{
            const url=new URL(request.url);
            if(url.pathname==='/en.vtt'||url.pathname==='/es.vtt')return new Response(`WEBVTT\n\n00:00:00.000 --> 00:00:29.000\n${url.pathname==='/en.vtt'?'English Webtor captions':'Spanish Webtor captions'}\n`,{headers:{'Content-Type':'text/vtt'}});
            if(url.pathname==='/movie.mp4'){
                const range=/bytes=(\d+)-(\d*)/.exec(request.headers.get('range')||'');
                const start=range?Number(range[1]):0,end=range?.[2]?Math.min(webtorBytes.length-1,Number(range[2])):webtorBytes.length-1;
                return new Response(webtorBytes.subarray(start,end+1),{status:range?206:200,headers:{'Content-Type':'video/mp4','Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${webtorBytes.length}`}:{})}});
            }
            if(url.pathname==='/stream-video'){
                assert.equal(request.method,'POST');streamPosts++;postOrigins.push(request.headers.get('origin'));
                return new Response(`<div class="wt-player-stage"><div class="wt-player"><video autoplay controls data-duration="600" data-run-offset="0" data-session-seek-url="/session/seek" src="/movie.mp4"></video><div class="wt-player-controls"><div class="wt-player-progress" role="slider" aria-valuemax="600" style="height:12px;width:100%"></div><button>Native play controls</button></div></div></div>
                    <dialog id="grace-cta"><button id="answerGrace">Continue watching</button></dialog><dialog id="subtitles"><button class="subtitle" data-id="none" data-default="true">Off</button><button class="subtitle" data-id="en" data-label="English" data-provider="Sidecar">English</button><button class="subtitle" data-id="es" data-label="Spanish" data-provider="MediaProbe">Spanish</button></dialog>
                    <script>
                    const video=document.querySelector('video');window.nativeSeekCalls=0;document.getElementById('answerGrace').onclick=()=>{document.getElementById('grace-cta').close();video.play()};
                    document.querySelector('.wt-player-progress').addEventListener('pointerdown',()=>document.addEventListener('pointerup',event=>{
                        const rect=document.querySelector('.wt-player-progress').getBoundingClientRect(),target=(event.clientX-rect.left)/rect.width*600;
                        const offset=Math.floor(target/30)*30;video.dataset.runOffset=offset;video.currentTime=target-offset;window.nativeSeekCalls++;
                    },{once:true}));
                    document.getElementById('subtitles').addEventListener('click',event=>{
                        const item=event.target.closest('.subtitle');if(!item)return;
                        document.querySelectorAll('.subtitle').forEach(el=>el.dataset.default=String(el===item));
                        Array.from(video.textTracks).forEach(track=>track.mode='disabled');if(item.dataset.id==='none')return;
                        let track=video.querySelector('track[data-lang="'+item.dataset.id+'"]');
                        if(!track){track=document.createElement('track');track.kind='subtitles';track.srclang=item.dataset.id;track.dataset.lang=item.dataset.id;track.src='/'+item.dataset.id+'.vtt';video.append(track);}track.track.mode='showing';
                    });
                    </script>`,{headers:{'Content-Type':'text/html'}});
            }
            return new Response('<video autoplay muted src="/movie.mp4" style="display:none"></video><div id="file" data-status-file="/Season/Episode 02.mp4"><h2>Episode 02.mp4</h2><form action="/stream-video" method="post" target="_blank"><input name="resource-id" value="'+'a'.repeat(40)+'"><input name="item-id" value="episode02"><button type="submit">Stream</button></form></div>',{headers:{'Content-Type':'text/html'}});
        });
        mockWebtor=true;
        await run("setBrowserSite('webtor',{load:false});navigateBrowserTo('https://webtor.io/'+'a'.repeat(40))");
        await until(async()=>await run("browserWebview.executeJavaScript(\"Boolean(document.querySelector('form')&&window.__watchPartyWebtorPage)\")"),'Webtor browser detector installed');
        await run("browserWebview.executeJavaScript(\"document.querySelector('video').play()\",true)");
        await until(async()=>await run("browserWebview.executeJavaScript(\"document.querySelector('video').videoWidth>0\")"),'hidden codec probe decoded without handoff');
        assert.equal(await run("playerWebview.src==='about:blank'"),true,'browsing a Webtor file must not start the upper player');
        await run("browserWebview.executeJavaScript(\"document.querySelector('button').click()\",true)");
        await until(async()=>await run("playerPane.classList.contains('is-webtor-player') && !playerPane.classList.contains('is-loading') && playerWebview.executeJavaScript(\"document.querySelector('video')?.currentTime>.5\")"),'actual browser playback is handed to the top player');
        assert.equal(await run("new URL(selectedVideoUrl).searchParams.get('file')==='/Season/Episode 02.mp4' && playingTitleEl.textContent==='Episode 02.mp4'"),true,'existing shared selection flow keeps the exact episode');
        assert.equal(await run("browserWebview.executeJavaScript(\"document.querySelector('video').paused && document.querySelector('video').muted\")"),true,'lower preview is paused without duplicate audio');
        assert.ok(streamPosts>=2);assert.ok(postOrigins.every(origin=>origin==='https://webtor.io'),'both panes use native first-party POSTs');
        console.log('PASS real Webtor browser playback triggers the existing selection flow, exact episode plays above, and lower preview pauses');
        const webtorPlayer=code=>run(`playerWebview.executeJavaScript(${JSON.stringify(code)})`);
        await until(async()=>await run("lastPlaybackState?.duration===600"),'app clock uses full duration rather than the 30-second cached segment');
        assert.equal(await webtorPlayer("getComputedStyle(document.querySelector('.wt-player-controls')).visibility"),'hidden');
        await run("document.getElementById('playPause').click()");
        await until(async()=>(await webtorPlayer('window.watchPartyPlayer.getState()')).paused,'app pauses Webtor');
        const pausedAt=(await webtorPlayer('window.watchPartyPlayer.getState()')).currentTime;await sleep(200);
        assert.ok(Math.abs((await webtorPlayer('window.watchPartyPlayer.getState()')).currentTime-pausedAt)<.1);
        await run("playbackProgressEl.value=508;playbackProgressEl.dispatchEvent(new Event('input'));playbackProgressEl.dispatchEvent(new Event('change'))");
        await until(async()=>{const state=await webtorPlayer('window.watchPartyPlayer.getState()');return state.paused&&!state.seeking&&Math.abs(state.currentTime-304.8)<1;},'app seeks beyond cached segment using native full-movie slider');
        assert.equal(await webtorPlayer('window.nativeSeekCalls'),1);
        await run("document.querySelector('.media-panel').scrollTop=0");
        const subtitlePoint=await run("(()=>{const r=document.getElementById('webtorSubtitleToggle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
        win.webContents.debugger.attach('1.3');
        for(const type of ['mousePressed','mouseReleased'])await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type,...subtitlePoint,button:'left',clickCount:1});
        await until(async()=>await run("!document.getElementById('webtorSubtitleMenu').hidden"),'real pointer opens app-owned on-screen subtitle menu');
        const englishPoint=await run("(()=>{const r=document.querySelector('#webtorSubtitleMenu [data-subtitle-id=\"en\"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
        for(const type of ['mousePressed','mouseReleased'])await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type,...englishPoint,button:'left',clickCount:1});
        win.webContents.debugger.detach();
        await until(async()=>await webtorPlayer("Array.from(document.querySelector('video').textTracks).some(t=>t.mode==='showing'&&t.activeCues?.[0]?.text==='English Webtor captions')"),'app subtitle selection loads real cues through provider handler');
        await run("document.getElementById('webtorSubtitleToggle').click()");
        await run("document.querySelector('#webtorSubtitleMenu [data-subtitle-id=\"none\"]').click()");
        await until(async()=>await webtorPlayer("Array.from(document.querySelector('video').textTracks).every(t=>t.mode==='disabled')"),'app turns subtitles Off');
        await run("document.getElementById('playPause').click();volumeControlEl.value=40;volumeControlEl.dispatchEvent(new Event('input'))");
        await until(async()=>await webtorPlayer("!document.querySelector('video').paused&&document.querySelector('video').volume===.4"),'app resumes Webtor and controls volume');
        console.log('PASS app Webtor pause/resume, full duration, native transcoder seek beyond cached segment, real subtitle clicks/cues/Off and volume; duplicate provider bar hidden');
        await webtorPlayer("document.querySelector('video').pause()");
        const unexpected=await run('readPlaybackState()');
        assert.equal(unexpected.requestedPaused,false);assert.equal(unexpected.buffering,true);
        await until(async()=>{await run('readPlaybackState()');return await webtorPlayer("!document.querySelector('video').paused")},'unexpected provider pause resumes without broadcasting a deliberate room pause');
        console.log('PASS decoded Webtor playback recovers an unexpected pause while retaining Play intent');
        await webtorPlayer("document.getElementById('grace-cta').showModal();document.querySelector('video').pause()");
        await webtorPlayer("window.watchPartyPlayer.syncTo(window.watchPartyPlayer.getState().currentTime,false)");
        assert.equal(await webtorPlayer("document.querySelector('video').paused"),true,'room heartbeat must not answer a provider prompt');
        assert.equal(await webtorPlayer("getComputedStyle(document.getElementById('grace-cta')).display==='none'"),false,'provider prompt must survive video-only layout');
        await webtorPlayer("document.getElementById('answerGrace').click()");
        await until(async()=>await webtorPlayer("!document.querySelector('video').paused"),'provider prompt response resumes playback');
        console.log('PASS provider grace prompt remains visible and room synchronization waits for the viewer response');
        await webtorPlayer("document.body.innerHTML='<div>Checking that you are not a robot</div><form action=\"/stream-video\" method=\"post\"><button>Stream</button></form>';window.challengeSubmits=0;document.addEventListener('submit',event=>{window.challengeSubmits++;event.preventDefault()})");
        for(let i=0;i<3;i++){
            const blocked=await run('readPlaybackState()');
            assert.equal(blocked.provider,'webtor');assert.equal(blocked.ready,false);assert.equal(blocked.needsInteraction,true);
        }
        assert.equal(await webtorPlayer('window.challengeSubmits'),0,'verification cannot cause an automatic submit loop');
        assert.equal(await webtorPlayer("document.getElementById('watch-party-webtor-layout')"),null,'verification page is not hidden by video-only layout');
        console.log('PASS provider verification stays visible, reports blocked playback and does not resubmit or read codec-probe clocks');
        await run("document.getElementById('stopPlayer').click()");
        await until(async()=>await run("playerWebview.src==='about:blank'"),'Webtor stop');
        await webtorSession.protocol.unhandle('https');mockWebtor=false;
        if(process.argv.includes('--live-webtor')){
            liveWebtor=true;
            await run("setBrowserSite('webtor',{load:false});navigateBrowserTo('https://webtor.io/08ada5a7a6183aae1e09d831df6748d566095a10')");
            await until(async()=>await run("browserWebview.executeJavaScript(\"Boolean(window.__watchPartyWebtorPage&&Array.from(document.forms).find(f=>new URL(f.action).pathname==='/stream-video'))\")"),'live Webtor Stream form',45000);
            await run("browserWebview.executeJavaScript(\"Array.from(document.forms).find(f=>new URL(f.action).pathname==='/stream-video').querySelector('button').click()\",true)");
            await until(async()=>await run("isWebtorVideoUrl(playerWebview.src) && !playerPane.classList.contains('is-loading') && playerWebview.executeJavaScript(\"(()=>{const v=document.querySelector('.wt-player video,video.player'),r=v?.getBoundingClientRect();return v?.currentTime>.5&&v.videoWidth>0&&r.width>100&&r.height>100&&!!v.closest('.watch-party-webtor-target')})()\")"),'live browser playback handed to upper media player',90000);
            const liveResult=await run("({file:new URL(selectedVideoUrl).searchParams.get('file'),title:playingTitleEl.textContent})");
            assert.equal(liveResult.file,'/Sintel/Sintel.mp4');
            await until(async()=>await run("lastPlaybackState?.duration>880"),'live app clock uses full Sintel duration');
            assert.equal(await webtorPlayer("getComputedStyle(document.querySelector('.wt-player-controls')).visibility"),'hidden');
            await run("document.getElementById('playPause').click()");
            await until(async()=>(await webtorPlayer('window.watchPartyPlayer.getState()')).paused,'live app pause');
            await run("playbackProgressEl.value=51;playbackProgressEl.dispatchEvent(new Event('input'));playbackProgressEl.dispatchEvent(new Event('change'))");
            await until(async()=>{const state=await webtorPlayer('window.watchPartyPlayer.getState()');return !state.seeking&&state.ready&&state.paused&&Math.abs(state.currentTime-state.duration*.051)<2;},'live native full-movie seek from app',60000);
            await run("document.getElementById('webtorSubtitleToggle').click()");
            const liveSubtitle=await webtorPlayer("window.watchPartyPlayer.getState().subtitles.find(s=>/^English/i.test(s.label)&&!s.disabled)");
            assert.ok(liveSubtitle,'live provider English subtitles are listed by app');
            await run(`Array.from(document.querySelectorAll('#webtorSubtitleMenu [data-subtitle-id]')).find(button=>button.dataset.subtitleId===${JSON.stringify(liveSubtitle.id)}).click()`);
            await until(async()=>await webtorPlayer("Array.from(document.querySelector('.wt-player video').textTracks).some(track=>track.cues?.length>0)"),'live subtitle cues loaded',30000);
            await run("document.getElementById('playPause').click()");
            await until(async()=>{const state=await webtorPlayer('window.watchPartyPlayer.getState()');return !state.paused&&!state.requestedPaused&&state.currentTime>state.duration*.051+.3&&await run('lastPlaybackPausedState===false');},'live app resume advances and app icon follows',45000);
            console.log('PASS LIVE app controls full duration, pause/seek/resume and provider English subtitle loading; native duplicate bar hidden');
            await sleep(1500);
            assert.equal(await run("!playerPane.classList.contains('is-loading') && document.getElementById('playerLoadingState').hidden"),true,'provider subframe loads cannot cover an already-playing movie with the loading overlay');
            assert.equal(await run("browserWebview.executeJavaScript(\"document.querySelector('video').paused\")"),true);
            console.log('PASS LIVE actual Webtor browser playback handed the exact Sintel file to the upper player',JSON.stringify(liveResult));
            fs.mkdirSync(path.resolve(__dirname,'../test-artifacts'),{recursive:true});
            fs.writeFileSync(path.resolve(__dirname,'../test-artifacts/webtor-native-flow.png'),(await win.webContents.capturePage()).toPNG());
            await run("document.getElementById('stopPlayer').click()");liveWebtor=false;
        }
        await run("document.querySelector('.media-panel').scrollTop=0");
        await run("document.getElementById('browseTorrent').click()");
        await run(`document.getElementById('torrentMagnet').value=${JSON.stringify(torrent.magnetURI)}; document.getElementById('loadTorrent').click()`);
        await until(async () => await run("document.getElementById('torrentFile').options.length===2 && !document.getElementById('playTorrent').disabled"), "torrent file list and host controls");
        await run("document.getElementById('torrentSearch').value='Ocean';document.getElementById('torrentSearch').dispatchEvent(new Event('input'))");
        await until(async () => await run("document.getElementById('torrentFile').options.length===1 && !document.getElementById('playTorrent').disabled"), "video search and prepare");
        await run("document.getElementById('queueTorrent').click()");
        await until(async () => await run("queueItems.length===1"), "queue add");
        console.log("PASS chat, provider tabs, torrent loading/search, and queue add");
        await run("document.getElementById('playTorrent').click()");
        assert.equal(await run("playerWebview.partition==='persist:eneclez-browser'"),true,"other providers restore their original player session");
        await until(async () => await run("playerPane.classList.contains('is-torrent-player') && getComputedStyle(playerWebview).pointerEvents==='auto'"), "torrent webview accepts clicks");
        const guestContents = webContents.fromId(await run("playerWebview.getWebContentsId()"));
        const player = code => guestContents.executeJavaScript(code);
        await until(async () => await player("window.watchPartyPlayer?.getState().ready && document.getElementById('subtitleSelect').options.length===3"), "embedded subtitle menu ready");
        await until(async () => await run("!document.getElementById('playbackReadiness').hidden && /Playing|Video ready/.test(document.getElementById('playbackReadiness').textContent)"), "parent readiness indicator follows actual decoded playback");
        await run("document.getElementById('playPause').click()");
        await until(async () => (await player("window.watchPartyPlayer.getState()")).paused, "pause before pointer test");
        await run("document.activeElement?.blur();document.querySelector('.media-panel').scrollTop=0;playerPane.scrollIntoView({block:'start'})");
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
        assert.equal(await run("document.getElementById('fullscreenMessages').scrollWidth<=document.getElementById('fullscreenMessages').clientWidth+1"), true, "long fullscreen chat messages wrap");
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
        await assertChatBounds("compact chat and composer stay inside their panel");
        await run("document.querySelector('.chat-panel').style.transition='none';document.getElementById('compactChatClose').click();browserPane.scrollIntoView({block:'start'})");
        await until(async () => await run("getComputedStyle(document.querySelector('.chat-panel')).opacity==='0'"), "compact chat closes without covering torrent controls");
        assert.equal(await run("document.getElementById('torrentPanel').getBoundingClientRect().height > 400 && browserPane.clientHeight >= document.getElementById('torrentPanel').offsetHeight"), true, "compact resizing must keep the active torrent browser visible");
        assert.equal(await run("document.getElementById('torrentPanel').scrollWidth <= document.getElementById('torrentPanel').clientWidth + 1"), true, "torrent UI must not overflow horizontally");
        fs.writeFileSync(path.join(artifacts, "torrent-ui-compact.png"), (await win.webContents.capturePage()).toPNG());
        assert.deepEqual(await run("window.__appErrors"), []);
        await run("document.getElementById('stopPlayer').click()");
        await until(async () => await run("playerWebview.src==='about:blank' && !playerPane.classList.contains('is-torrent-player') && document.getElementById('playPause').disabled && document.getElementById('nowPlaying').hidden"), "stop resets player, title and controls");
        console.log("PASS responsive torrent UI, no renderer exceptions, and stop/reset");
        await run("document.getElementById('torrentDelivery').value='cloud';document.getElementById('torrentDelivery').dispatchEvent(new Event('change'))");
        await until(async()=>await run("document.getElementById('torrentDeliveryHint').textContent.includes('One cloud cache')"),"cloud delivery selection");
        assert.equal(await run("document.getElementById('chooseTorrentFile').disabled"),true);
        await run(`document.getElementById('torrentMagnet').value=${JSON.stringify(torrent.magnetURI)};document.getElementById('loadTorrent').click()`);
        await until(async()=>await run("document.getElementById('torrentStatus').textContent.includes('Cloud cache is not configured') && !document.getElementById('loadTorrent').disabled"),"unconfigured cloud gives an actionable message and recovers controls");
        assert.deepEqual(await run("window.__appErrors"),[]);
        console.log("PASS cloud mode selection, magnet-only loading, room-server configuration error, and recovered controls");
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
