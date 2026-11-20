const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path"), http = require("node:http");
const { once } = require("node:events"), { createRequire } = require("node:module");
const { createCloudCache, base32Hash } = require("../../server/cloud-cache.cjs");
const { prepareCloudTorrent } = require("../../server/cloud-client.cjs");
const { TorrentService } = require("../torrent-service.cjs");
const { parseTorrentLink } = require("../src/js/torrent-links");
const { io } = require("../../server/node_modules/socket.io/client-dist/socket.io.js");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = "local-test-key-" + "x".repeat(32);
async function fixture(t, settings = {}) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "watchparty-cloud-"));
    let cache;
    const server = http.createServer((req,res) => cache.app(req,res));
    server.listen(0,"127.0.0.1"); await once(server,"listening");
    const origin = `http://127.0.0.1:${server.address().port}`;
    cache = createCloudCache({ apiKey:key, publicOrigin:origin, cachePath:path.join(directory,"cache"), ...settings });
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await cache.close(); await fs.rm(directory,{recursive:true,force:true}); });
    const post = (body, auth = key) => fetch(`${origin}/api/torrents`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${auth}`}, body:JSON.stringify(body) });
    return { cache, directory, origin, post };
}

test("two cloud readers reuse one downloaded torrent after the seeder disconnects", { timeout:30000 }, async t => {
    const options = { utp:false, dht:false, tracker:false, lsd:false, natUpnp:false, natPmp:false };
    const { default:WebTorrent } = await import("webtorrent");
    let seed = new WebTorrent(options), engines = 0;
    t.after(async () => { if (seed) await new Promise(resolve => seed.destroy(resolve)); });
    const f = await fixture(t, { serviceFactory:directory => {
        engines++;
        const service = new TorrentService(directory, options), prepare = service.prepare.bind(service);
        service.prepare = async magnet => {
            const task = prepare(magnet);
            while (!service.current) await sleep(10);
            service.current.addPeer(`127.0.0.1:${seed.torrentPort}`);
            return task;
        };
        return service;
    } });
    const bytes = require("node:crypto").randomBytes(2 * 1024 ** 2);
    const movie = path.join(f.directory,"generated.mp4"); await fs.writeFile(movie,bytes);
    const torrent = await new Promise(resolve => seed.seed(movie,{announce:[]},resolve));
    const magnet = torrent.magnetURI;
    assert.equal((await f.post({magnet},"wrong-key")).status,401);
    const [a,b] = await Promise.all([f.post({magnet,fileIndex:0}).then(r=>r.json()), f.post({magnet,fileIndex:0}).then(r=>r.json())]);
    assert.equal(a.ok,true,JSON.stringify(a)); assert.equal(b.ok,true,JSON.stringify(b));
    assert.equal(engines,1); assert.equal(a.playerUrl,b.playerUrl);
    const stream = a.playerUrl.replace("/player?","/stream?");
    assert.deepEqual(Buffer.from(await (await fetch(stream)).arrayBuffer()),bytes);
    const cachedAt=Date.now();
    while ([...f.cache.entries.values()][0].service.describe().files[0].downloaded < bytes.length && Date.now()-cachedAt<3000) await sleep(25);
    await new Promise(resolve => seed.destroy(resolve)); seed = null;
    const readers = await Promise.all([fetch(stream,{headers:{Range:"bytes=123-34567"}}),fetch(stream,{headers:{Range:"bytes=1000000-1099999"}})]);
    assert.equal(readers[0].status,206); assert.equal(readers[1].status,206);
    assert.deepEqual(Buffer.from(await readers[0].arrayBuffer()),bytes.subarray(123,34568));
    assert.deepEqual(Buffer.from(await readers[1].arrayBuffer()),bytes.subarray(1000000,1100000));
    const status = await (await fetch(a.statusUrl)).json(); assert.equal(status.files[0].downloaded,bytes.length);
    const page = await fetch(a.playerUrl); assert.match(await page.text(),/bufferingState/);
    const script = await fetch(new URL("torrent-player.js",a.playerUrl)); assert.match(await script.text(),/watchPartyPlayer/);
    assert.equal(page.headers.get("access-control-allow-origin"),"*");
    assert.equal((await fetch(`${f.origin}/cache/${"a".repeat(48)}/status`)).status,404);
    const result = await prepareCloudTorrent({ CLOUD_CACHE_URL:f.origin,CLOUD_CACHE_KEY:key },{magnet,fileIndex:0});
    assert.equal(result.playerUrl,a.playerUrl); assert.ok(!JSON.stringify(result).includes(key));
});

test("cache limits, expiring links, and magnet sanitation protect the worker", async t => {
    let lastMagnet, destroyed = 0;
    const f = await fixture(t, { maxTorrents:1,maxBytes:100,idleMs:60000, serviceFactory:() => ({
        token:"test",current:{length:100}, prepare:async magnet => { lastMagnet=magnet; return {}; },
        describe:() => ({files:[{index:0,name:"test.mp4",length:100}],preferredFileIndex:0}), player() {}, destroy:async () => {destroyed++;}
    }) });
    const magnet = `magnet:?xt=urn:btih:${"a".repeat(40)}&ws=http://127.0.0.1/private&xs=http://169.254.169.254/metadata&tr=http://localhost/tracker`;
    const a = await (await f.post({magnet,fileIndex:0})).json(); assert.equal(a.ok,true);
    assert.equal(lastMagnet,`magnet:?xt=urn:btih:${"a".repeat(40)}`);
    assert.equal((await f.post({magnet:`magnet:?xt=urn:btih:${"b".repeat(40)}`})).status,503);
    const entry = [...f.cache.entries.values()][0]; entry.touched = 0; entry.active=1; await f.cache.sweep(); assert.equal(f.cache.entries.size,1);
    entry.active=0; await f.cache.sweep(); assert.equal(f.cache.entries.size,0); assert.equal(destroyed,1);
    assert.equal((await fetch(a.statusUrl)).status,404);
    assert.equal(base32Hash("a".repeat(32)),"0".repeat(40));
    assert.equal(parseTorrentLink(`${magnet}&wpCloud=1&wpFile=2`).cloud,true);
    assert.ok(!parseTorrentLink(`${magnet}&wpCloud=1`).magnet.includes("wpCloud"));
});

test("cloud preparation requires room membership and lets late guests watch the shared file", {timeout:15000}, async t => {
    let calls = 0;
    const worker = await fixture(t,{serviceFactory:() => ({token:"test", current:{length:100},prepare:async () => {calls++;return {};},describe:() => ({files:[{index:0,name:"test.mp4",length:100}],preferredFileIndex:0}),player() {},destroy:async()=>{}})});
    const directory = path.resolve(__dirname,"../../server");
    const env = {...process.env,PORT:"0",CLOUD_CACHE_URL:worker.origin,CLOUD_CACHE_KEY:key};
    const server = new Function("require","__dirname","process",require("node:fs").readFileSync(path.join(directory,"server.js"),"utf8")+"\nreturn server;")(createRequire(path.join(directory,"server.js")),directory,{env});
    if (!server.listening) await once(server,"listening");
    const clients = [];
    t.after(async()=>{for(const socket of clients)socket.disconnect();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    async function join(username,room) { const socket=io(`http://127.0.0.1:${server.address().port}`,{transports:["websocket"],forceNew:true});clients.push(socket);await once(socket,"connect");const joined=once(socket,"roomUsers");socket.emit("joinRoom",{room,username,create:username==="host"});await joined;return socket; }
    const host=await join("host","cloud-test"), guest=await join("guest","cloud-test"), outsider=await join("host","other-room");
    const magnet=`magnet:?xt=urn:btih:${"c".repeat(40)}&wpFile=0&wpCloud=1`;
    const request = socket => new Promise(resolve=>socket.emit("prepareCloudTorrent",{room:"cloud-test",magnet,fileIndex:0},resolve));
    assert.equal((await request(guest)).ok,false); assert.equal((await request(outsider)).ok,false); assert.equal(calls,0);
    assert.equal((await request(host)).ok,true);
    assert.equal((await new Promise(resolve=>host.emit("loadMedia",{room:"cloud-test",url:magnet,title:"Cloud test"},resolve))).ok,true);
    const result=await request(guest); assert.equal(result.ok,true); assert.equal(result.cloud,true); assert.equal(calls,1);
    assert.ok(!JSON.stringify(result).includes(key));
});

test("storage reservations survive a worker restart and oversized torrents are removed", async t => {
    const fake = length => () => ({token:"test",current:{length},prepare:async()=>({}),describe:()=>({files:[{index:0,name:"test.mp4",length}],preferredFileIndex:0}),player(){},destroy:async()=>{}});
    const first = await fixture(t,{maxBytes:100,serviceFactory:fake(100)});
    const magnet=`magnet:?xt=urn:btih:${"d".repeat(40)}`;
    assert.equal((await first.post({magnet,fileIndex:0})).status,200);
    await first.cache.close();
    const second=await fixture(t,{cachePath:path.join(first.directory,"cache"),maxBytes:100,serviceFactory:fake(100)});
    const tooLarge=await second.post({magnet:`magnet:?xt=urn:btih:${"e".repeat(40)}`,fileIndex:0});
    assert.equal(tooLarge.status,502);assert.match((await tooLarge.json()).error,/storage limit/);
    assert.equal(second.cache.entries.size,0);
    assert.equal((await second.post({magnet,fileIndex:0})).status,200,"the original disk reservation is reused rather than counted twice");
});

test("desktop cloud routing preserves shared mode and never silently falls back to local peers", async()=>{
    const vm=require("node:vm");let local=0,remote=0;
    const socket={connected:true,emit(event,request,reply){assert.equal(event,"prepareCloudTorrent");assert.equal(request.room,"room-test");remote++;reply({ok:true,cloud:true});}};
    const context={socket,roomCode:"room-test",parseTorrentLink,setTimeout,clearTimeout,window:{watchParty:{prepareTorrent:async()=>{local++;return {ok:true};}}}};
    vm.createContext(context);vm.runInContext(require("node:fs").readFileSync(path.join(__dirname,"../src/js/cloud-torrents.js"),"utf8"),context);
    const magnet=`magnet:?xt=urn:btih:${"f".repeat(40)}`;
    await context.prepareTorrentSource({magnet});assert.equal(local,1);
    await context.prepareTorrentSource({magnet:`${magnet}&wpCloud=1&wpFile=0`});assert.equal(remote,1);assert.equal(local,1);
    socket.connected=false;const result=await context.prepareTorrentSource({magnet,cloud:true});assert.equal(result.ok,false);assert.equal(local,1);assert.equal(remote,1);
});
