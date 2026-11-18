const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { parseTorrentLink } = require("../src/js/torrent-links");
const source = fs.readFileSync(path.join(__dirname, "../src/js/room.js"), "utf8").replace(/\r\n/g, "\n");
function fixture() {
    const handlers = new Map(), timers = new Map(), messages = []; let ack, id = 0, sends = 0;
    const socket = { connected: true,
        on(event, callback) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(callback); },
        off(event, callback) { handlers.get(event)?.delete(callback); },
        emit(_event, _request, callback) { sends++; ack = callback; } };
    const url = `magnet:?xt=urn:btih:${"a".repeat(40)}&wpFile=0`;
    const context = { socket, selectedVideoUrl: url, pendingTorrentShareCancel: null, addSystemMessage: message => messages.push(message),
        isSameVideoUrl(a, b) { const first = parseTorrentLink(a), second = parseTorrentLink(b); return first?.hash === second?.hash && first?.fileIndex === second?.fileIndex; },
        setTimeout: callback => { timers.set(++id, callback); return id; }, clearTimeout: key => timers.delete(key) };
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf("function shareTorrentWithRoom("), source.indexOf("function openPlayerFromUrl(")), context);
    return { context, socket, url, timers, messages, handlers, ack: value => ack(value), sends: () => sends,
        receive: (event, value) => [...(handlers.get(event) || [])].forEach(callback => callback(value)),
        expire() { for (const [key, callback] of [...timers]) { timers.delete(key); callback(); } } };
}
test("room broadcast confirms sharing even when an older server omits acknowledgement", () => {
    const f = fixture(); f.context.shareTorrentWithRoom({ url: f.url });
    f.receive("mediaLoaded", { url: f.url }); f.expire();
    assert.deepEqual(f.messages, []); assert.equal(f.timers.size, 0); assert.equal(f.handlers.get("mediaLoaded").size, 0);
    f.ack({ ok: true }); assert.deepEqual(f.messages, []);
});
test("another file does not falsely confirm a torrent, and rejection is reported", () => {
    const f = fixture(); f.context.shareTorrentWithRoom({ url: f.url });
    f.receive("mediaLoaded", { url: f.url.replace("wpFile=0", "wpFile=1") });
    assert.equal(f.timers.size, 1); f.ack({ ok: false, message: "Only the host can share" });
    assert.deepEqual(f.messages, ["Only the host can share"]); assert.equal(f.timers.size, 0);
});
test("unconfirmed sharing gives a server recovery action and a new request cancels the old timer", () => {
    const f = fixture(); f.context.shareTorrentWithRoom({ url: f.url }); f.context.shareTorrentWithRoom({ url: f.url });
    assert.equal(f.timers.size, 1); f.expire();
    assert.equal(f.messages.length, 1); assert.match(f.messages[0], /Update or restart the room server/);
});
test("disconnected sharing is not buffered for accidental replay after reconnection", () => {
    const f = fixture(); f.socket.connected = false; f.context.shareTorrentWithRoom({ url: f.url });
    assert.equal(f.sends(), 0); assert.match(f.messages[0], /Reconnect/);
    f.socket.connected = true; f.context.shareTorrentWithRoom({ url: f.url }); f.receive("disconnect");
    assert.match(f.messages[1], /Connection lost/); assert.equal(f.timers.size, 0);
});
