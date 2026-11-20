// Opt-in comparison using generated video and a private, loopback-only tracker.
// No app configuration, installed app, public media, or room server is changed.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), net = require("node:net");
const assert = require("node:assert/strict"), crypto = require("node:crypto"), {once} = require("node:events");
const {spawn,execFileSync} = require("node:child_process"), {createRequire} = require("node:module"), {pathToFileURL} = require("node:url");
const root = path.resolve(__dirname,".."), clientRequire = createRequire(path.join(root,"client/package.json"));
const {TorrentService} = clientRequire("./torrent-service.cjs");
const tools = path.join(root,".tools/torrent-engines");
const selected = process.argv.find(arg=>arg.startsWith("--engine="))?.split("=")[1] || "all";
const rounds=Number(process.argv.find(arg=>arg.startsWith("--rounds="))?.split("=")[1]||1);
if(!Number.isSafeInteger(rounds)||rounds<1||rounds>5)throw new Error("Use --rounds=1 through 5");
const names = ["current","cloud-torrent","torrserver"];
if (!names.includes(selected) && selected !== "all") throw new Error("Use --engine=current, cloud-torrent, torrserver, or all");
const binaries = {
    "cloud-torrent":{file:"cloud-torrent_0.10.0-rc.5_windows_amd64.exe",gzip:"cloud-torrent_0.10.0-rc.5_windows_amd64.gz",sha256:"edf8155d6aa8ebdbeafa4d1dada55a576e02eb1179e1ea5dec5f44f115791b90"},
    torrserver:{file:"TorrServer-MatriX.150-windows-amd64.exe",sha256:"3a96b97a24d86a90c0712a6ec47d4ed52edc7eabac1bce6a0d9bbc8fd30de5bb"}
};
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,ms=30000) {const at=Date.now();while(Date.now()-at<ms){if(await fn())return;await sleep(100);}throw new Error(`Timed out: ${label}`);}
async function port() {const s=net.createServer();s.listen(0,"127.0.0.1");await once(s,"listening");const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;}
async function json(url,body) {const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const text=await r.text();if(!r.ok)throw new Error(`${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null;}
function verify(name) {
    const info=binaries[name], binary=path.join(tools,info.file);
    if(!fs.existsSync(binary))throw new Error(`Install the pinned official binary first: ${binary}`);
    const source=fs.readFileSync(path.join(tools,info.gzip||info.file));
    assert.equal(crypto.createHash("sha256").update(source).digest("hex"),info.sha256,`${name} release checksum`);
    if(info.gzip)assert.deepEqual(fs.readFileSync(binary),require("node:zlib").gunzipSync(source),"extracted executable must match verified archive");
    return binary;
}
async function run(name,movie,bytes,runPath) {
    const directory=path.join(runPath,name);fs.mkdirSync(directory,{recursive:true});
    const {default:WebTorrent}=await import(pathToFileURL(clientRequire.resolve("webtorrent")).href);
    const {default:Tracker}=await import(pathToFileURL(path.join(root,"client/node_modules/bittorrent-tracker/server.js")).href);
    let tracker,seed,fixture,service,child,diagnostics,logs="";
    try {
        tracker=new Tracker({udp:false,ws:false,stats:false});tracker.on("error",error=>{logs+=error.message+"\n";});
        for(const event of ["start","update","complete"])tracker.on(event,(address,params)=>{logs+=`Tracker ${event} ${address} left=${params.left}\n`;});
        tracker.listen(0,"127.0.0.1");await once(tracker,"listening");
        const announce=`http://127.0.0.1:${tracker.http.address().port}/announce`;
        seed=new WebTorrent({utp:false,dht:false,lsd:false,natUpnp:false,natPmp:false,uploadLimit:2*1024**2});
        const torrent=await new Promise((resolve,reject)=>{seed.once("error",reject);seed.seed(movie,{announce:[announce],private:true},resolve);});
        fixture=http.createServer((req,res)=>{res.setHeader("Content-Type","application/x-bittorrent");res.end(torrent.torrentFile);});
        fixture.listen(0,"127.0.0.1");await once(fixture,"listening");
        const metadataUrl=`http://127.0.0.1:${fixture.address().port}/fixture.torrent`;
        // Warm the seeder's token bucket equally for each engine, so slower
        // process startup does not give one candidate a larger initial burst.
        await sleep(2000);
        let streamUrl,start;
        if(name==="current") {
            service=new TorrentService(path.join(directory,"cache"),{utp:false,dht:false,lsd:false,natUpnp:false,natPmp:false});
            start=performance.now();await service.prepare(torrent.torrentFile);streamUrl=service.player(0).replace("/player?","/stream?");
        } else {
            const binary=verify(name),webPort=await port(),origin=`http://127.0.0.1:${webPort}`;
            fs.mkdirSync(path.join(directory,"state"),{recursive:true});
            let args,engineSettings;
            if(name==="cloud-torrent") {
                const config=path.join(directory,"config.json");
                fs.writeFileSync(config,JSON.stringify({DownloadDirectory:path.join(directory,"downloads"),AutoStart:true,DownloadLimitKiB:0,UploadLimitKiB:0,IncomingPort:await port(),EnableUpload:false,EnableSeeding:false}));
                args=["--host","127.0.0.1","--port",String(webPort),"--config-path",config,"--state-directory",path.join(directory,"state"),"--outbound-allow-cidrs","127.0.0.1/32"];
            } else {
                engineSettings={CacheSize:64*1024**2,ReaderReadAHead:95,PreloadCache:12,DisableDHT:true,DisablePEX:true,DisableUTP:true,DisableUPNP:true,DisableUpload:true,EnableDLNA:false,EnableBonjour:false,EnableLPD:false,RetrackersMode:0,DownloadRateLimit:0,UploadRateLimit:0,StoreSettingsInJson:true,ResponsiveMode:true,ConnectionsLimit:100};
                fs.writeFileSync(path.join(directory,"state/settings.json"),JSON.stringify(engineSettings));
                args=["--ip","127.0.0.1","--port",String(webPort),"--path",path.join(directory,"state"),"--torrentaddr",`127.0.0.1:${await port()}`];
            }
            child=spawn(binary,args,{cwd:directory,windowsHide:true,stdio:["ignore","pipe","pipe"]});
            child.stdout.on("data",data=>{logs+=data;});child.stderr.on("data",data=>{logs+=data;});child.on("error",error=>{logs+=error.stack;});
            await until(async()=>{if(child.exitCode!==null)throw new Error(`Engine exited ${child.exitCode}: ${logs}`);try{return(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}},`${name} HTTP startup`);
            if(name==="cloud-torrent") {
                start=performance.now();
                const response=await fetch(`${origin}/api/torrentfile`,{method:"POST",body:torrent.torrentFile,signal:AbortSignal.timeout(30000)});
                if(!response.ok)throw new Error(await response.text());
                streamUrl=`${origin}/download/${encodeURIComponent(path.basename(movie))}`;
                await until(async()=>{
                    const r=await fetch(streamUrl,{method:"HEAD",signal:AbortSignal.timeout(1000)});
                    if(r.ok)return true;
                    const partial=await fetch(`${streamUrl}.part`,{method:"HEAD",signal:AbortSignal.timeout(1000)});
                    if(partial.ok){streamUrl+=".part";return true;}return false;
                },"download file appears");
            } else {
                const settings=await json(`${origin}/settings`,{action:"get"});
                if(!settings.DisableUPNP || !settings.DisableDHT || settings.PreloadCache!==12) await json(`${origin}/settings`,{action:"set",sets:{...settings,...engineSettings}});
                start=performance.now();console.log("TorrServer: adding generated torrent");
                await json(`${origin}/torrents`,{action:"add",link:metadataUrl,save_to_db:false});
                console.log("TorrServer: requesting streamed bytes");
                streamUrl=`${origin}/stream/generated.mp4?link=${torrent.infoHash}&index=1&play=1`;
                diagnostics=setInterval(async()=>{
                    try{const s=await json(`${origin}/torrents`,{action:"get",hash:torrent.infoHash});console.log(JSON.stringify({phase:s.stat_string,loaded:s.loaded_size,peers:s.active_peers,seeders:s.connected_seeders,rate:s.download_speed,piecesGood:s.pieces_dirtied_good}));}catch{}
                },5000);
            }
        }
        const response=await fetch(streamUrl,{signal:AbortSignal.timeout(45000)});
        assert.equal(response.status,200,`${name}: ${await (!response.ok?response.text():Promise.resolve(""))}`);
        const reader=response.body.getReader(),chunks=[];let firstByteMs=0;
        while(true){const next=await reader.read();if(next.done)break;if(!firstByteMs)firstByteMs=performance.now()-start;chunks.push(Buffer.from(next.value));}
        const elapsed=performance.now()-start,actual=Buffer.concat(chunks);
        const digest=data=>crypto.createHash("sha256").update(data).digest("hex");
        assert.equal(digest(actual),digest(bytes),`${name}: streaming an incomplete file returned missing or incorrect video bytes`);
        const seekAt=Math.floor(bytes.length*.7),seekEnd=Math.min(bytes.length-1,seekAt+262143),seekStart=performance.now();
        const seek=await fetch(streamUrl,{headers:{Range:`bytes=${seekAt}-${seekEnd}`},signal:AbortSignal.timeout(15000)});assert.equal(seek.status,206);
        assert.equal(digest(Buffer.from(await seek.arrayBuffer())),digest(bytes.subarray(seekAt,seekEnd+1)));
        return {engine:name,version:name==="cloud-torrent"?"0.10.0-rc.5":name==="torrserver"?"MatriX.150":"Watch Party 1.0.19 working tree",bytes:bytes.length,firstByteMs:Math.round(firstByteMs),totalMs:Math.round(elapsed),megabytesPerSecond:Number((bytes.length/1e6/(elapsed/1000)).toFixed(2)),cachedSeekMs:Math.round(performance.now()-seekStart),integrity:"PASS",streamUrl};
    } finally {
        clearInterval(diagnostics);
        if(child&&child.exitCode===null){child.kill();await Promise.race([once(child,"exit"),sleep(3000)]);}
        await service?.destroy();if(seed)await new Promise(resolve=>seed.destroy(resolve));if(fixture){fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}if(tracker)await new Promise(resolve=>tracker.close(resolve));
        fs.writeFileSync(path.join(directory,"engine.log"),logs);
    }
}
(async()=>{
    const runPath=path.join(tools,"runs",new Date().toISOString().replace(/[:.]/g,"-"));fs.mkdirSync(runPath,{recursive:true});
    const movie=path.join(runPath,"generated.mp4");
    execFileSync(clientRequire("ffmpeg-static"),["-hide_banner","-loglevel","error","-f","lavfi","-i","testsrc2=size=640x360:rate=24","-f","lavfi","-i","sine=frequency=440:sample_rate=48000","-t","30","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-b:v","4M","-minrate","4M","-maxrate","4M","-bufsize","8M","-x264-params","nal-hrd=cbr","-c:a","aac","-movflags","+faststart","-y",movie],{windowsHide:true});
    const bytes=fs.readFileSync(movie),results=[];
    for(const name of selected==="all"?names:[selected]) for(let round=1;round<=rounds;round++){
        try{const result=await run(name,movie,bytes,path.join(runPath,`round-${round}`));result.round=round;results.push(result);console.log(JSON.stringify(result));}
        catch(error){results.push({engine:name,error:error.message});console.error(`${name}: ${error.stack}`);process.exitCode=1;}
    }
    const report={at:new Date().toISOString(),scope:"Generated private torrent, one local TCP seeder and local HTTP tracker; no public-swarm speed claims",results};
    fs.writeFileSync(path.join(runPath,"results.json"),JSON.stringify(report,null,2));console.log(`Report: ${path.join(runPath,"results.json")}`);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
