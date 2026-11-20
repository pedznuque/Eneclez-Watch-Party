const test = require("node:test"), assert = require("node:assert/strict");
const { playerFixture } = require("./player-fixture.cjs");
const { needsCompatibility } = require("../torrent-service.cjs");

test("a decoded frame with only three seconds buffered cannot start the clock", async () => {
    const f = await playerFixture(); f.buffer(3);
    assert.equal(f.video.paused, true); assert.equal(f.player.getState().ready, false);
    assert.equal(f.player.getState().currentTime, 0); assert.equal(f.player.getState().bufferTarget, 8);
    assert.match(f.element("readinessBadge").textContent, /Buffering/);
    f.buffer(12);
    assert.equal(f.player.getState().ready, true); assert.equal(f.video.paused, false);
});
test("underflow pauses actual playback and waits for a refill before resuming", async () => {
    const f = await playerFixture(); f.buffer(12); f.video.currentTime = 11.9; f.tick();
    assert.equal(f.video.paused, true); assert.equal(f.player.getState().buffering, true);
    assert.equal(f.player.getState().requestedPaused, false);
    await new Promise(resolve => setImmediate(resolve));
    f.buffer(20); assert.equal(f.video.paused, false); assert.equal(f.player.getState().ready, true);
});
test("room heartbeats cannot repeatedly cancel a slow compatibility startup", async () => {
    const f = await playerFixture({ compatibility: true }); f.buffer(3);
    await f.player.syncTo(1, false, { paused: false });
    f.advance(3000); await f.player.syncTo(4, false, { paused: false });
    assert.equal(f.sources.length, 1); assert.equal(f.video.paused, true);
    f.buffer(20); f.tick();
    assert.equal(f.player.getState().ready, true); assert.ok(Math.abs(f.player.getState().currentTime - 4) < .1);
    await f.player.syncTo(60, true, { paused: true });
    assert.equal(f.sources.length, 2); assert.match(f.sources[1], /start=60/);
});
test("a viewer can be ready locally while waiting for the room buffer hold to clear", async () => {
    const f = await playerFixture(); await f.player.syncTo(0, false, { paused: true, buffering: true }); f.buffer(12);
    assert.equal(f.player.getState().ready, true); assert.equal(f.video.paused, true); assert.equal(f.player.getState().waitingForRoom, true);
    await f.player.syncTo(0, false, { paused: false, buffering: false }); assert.equal(f.video.paused, false);
});
test("unsupported audio triggers conversion even when the video codec is natively supported", () => {
    for (const audio of ["eac3", "ac3", "dts", "truehd"]) assert.equal(needsCompatibility("h264", audio), true);
    assert.equal(needsCompatibility("h264", "aac", "Video: h264, yuv420p"), false);
    assert.equal(needsCompatibility("hevc", "aac"), true);
    assert.equal(needsCompatibility("h264", "aac", "Video: h264, yuv420p10le"), true);
});

test("native preload suspension switches to a buffer that can fill while paused", async () => {
    const f = await playerFixture(); f.video.networkState = 1; f.buffer(2);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.sources.length, 2); assert.match(f.sources[1], /transcode/);
    assert.equal(f.video.paused, true);
    f.buffer(12); assert.equal(f.player.getState().ready, true);
});

test("a conversion failure is shown as a playback error instead of endless buffering", async () => {
    const f = await playerFixture({ fetchStatus: async () => ({ ok:true, status:200, json:async () => ({ conversionError:"Compatibility conversion failed" }) }) });
    await f.timers.get(1500)();
    assert.equal(f.player.getState().phase, "error");
    assert.match(f.element("status").textContent, /conversion failed/);
    assert.equal(f.video.paused, true);
});
