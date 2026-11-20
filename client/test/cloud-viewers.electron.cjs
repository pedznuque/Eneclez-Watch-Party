const {app,BrowserWindow}=require("electron");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process"),{once}=require("node:events");
const {createCloudCache}=require("../../server/cloud-cache.cjs");
const {TorrentService}=require("../torrent-service.cjs");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"watchparty-cloud-viewers-"));
if(process.env.WATCH_PARTY_TEST_TEMP_FILE)fs.writeFileSync(process.env.WATCH_PARTY_TEST_TEMP_FILE,temp);
app.setPath("userData",path.join(temp,"userData"));
app.commandLine.appendSwitch("autoplay-policy","no-user-gesture-required");
app.on("window-all-closed",()=>{});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){const start=Date.now();while(Date.now()-start<45000){if(await fn())return;await sleep(100);}throw new Error(`Timed out: ${label}`);}
let cache,server,seed;const windows=[];
app.whenReady().then(async()=>{
    try{
        const movie=path.join(temp,"generated.mkv"),srt=path.join(temp,"captions.srt");
        fs.writeFileSync(srt,"1\n00:00:00,000 --> 00:00:29,000\nCloud captions\n\n");
        execFileSync(require("ffmpeg-static"),["-hide_banner","-loglevel","error","-f","lavfi","-i","testsrc2=size=320x180:rate=24","-f","lavfi","-i","sine=frequency=440:sample_rate=48000","-i",srt,"-t","30","-map","0:v:0","-map","1:a:0","-map","2:0","-c:v","libx264","-preset","ultrafast","-c:a","eac3","-c:s","srt","-metadata:s:s:0","language=eng","-y",movie],{windowsHide:true});
        const options={utp:false,dht:false,tracker:false,lsd:false,natUpnp:false,natPmp:false};
        const {default:WebTorrent}=await import("webtorrent");seed=new WebTorrent(options);
        const torrent=await new Promise(resolve=>seed.seed(movie,{announce:[]},resolve));
        server=http.createServer((req,res)=>cache.app(req,res));server.listen(0,"127.0.0.1");await once(server,"listening");
        const origin=`http://127.0.0.1:${server.address().port}`,key="test-secret-"+"x".repeat(32);let engines=0;
        cache=createCloudCache({apiKey:key,publicOrigin:origin,cachePath:path.join(temp,"cache"),serviceFactory:directory=>{
            engines++;const service=new TorrentService(directory,options),prepare=service.prepare.bind(service);
            service.prepare=async magnet=>{const task=prepare(magnet);await until(()=>service.current,"cloud metadata request");service.current.addPeer(`127.0.0.1:${seed.torrentPort}`);return task;};return service;
        }});
        const prepared=await(await fetch(`${origin}/api/torrents`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({magnet:torrent.magnetURI,fileIndex:0})})).json();
        assert.equal(prepared.ok,true,JSON.stringify(prepared));
        // Fully cache the generated fixture, then remove its only peer before
        // either viewer starts: both video and audio must come from cloud disk.
        await(await fetch(prepared.playerUrl.replace("/player?","/stream?"))).arrayBuffer();
        await new Promise(resolve=>seed.destroy(resolve));seed=null;
        for(let index=0;index<2;index++){
            const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false,offscreen:true}});windows.push(win);await win.loadURL(prepared.playerUrl);
            await until(async()=>await win.webContents.executeJavaScript("window.watchPartyPlayer?.getState().ready && document.getElementById('video').webkitAudioDecodedByteCount > 0"),`viewer ${index+1} video and audio`);
        }
        assert.equal(engines,1);
        for(const win of windows)assert.ok(await win.webContents.executeJavaScript("document.getElementById('subtitleText').textContent.includes('Cloud captions')"));
        const host=windows[0],guest=windows[1];
        const read=win=>win.webContents.executeJavaScript("window.watchPartyPlayer.getState()");
        async function sync(){const state=await read(host);await guest.webContents.executeJavaScript(`window.watchPartyPlayer.syncTo(${state.currentTime},${state.requestedPaused},{paused:${state.paused},buffering:${state.buffering}})`);}
        await host.webContents.executeJavaScript("window.watchPartyPlayer.setPaused(true)");await sync();assert.equal((await read(guest)).paused,true);
        await host.webContents.executeJavaScript("window.watchPartyPlayer.seekTo(18,false)");await until(async()=>(await read(host)).ready,"host seek buffered");await sync();await until(async()=>{const s=await read(guest);return s.ready&&s.paused&&Math.abs(s.currentTime-18)<.3;},"guest follows paused seek");
        await host.webContents.executeJavaScript("window.watchPartyPlayer.setPaused(false)");await sync();await until(async()=>{const s=await read(guest);return !s.paused&&s.currentTime>18.3;},"guest resumes cached stream");
        console.log("PASS two viewers stream shared cached video, converted EAC3 audio and captions after the seeder disconnects; pause, seek and resume work with one cloud torrent engine");
    }catch(error){console.error(error.stack);process.exitCode=1;}
    finally{for(const win of windows)win.destroy();if(cache)await cache.close();if(seed)await new Promise(resolve=>seed.destroy(resolve));if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}app.exit(process.exitCode||0);}
});
