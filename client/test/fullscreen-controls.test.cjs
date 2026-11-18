const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/js/room.js"), "utf8").replace(/\r\n/g, "\n");
function fixture() {
    const classes = new Set(), timers = new Map(), saved = new Map(); let timerId = 0;
    const stage = { classList: { contains: key => classes.has(key), add: key => classes.add(key), remove: (...keys) => keys.forEach(key => classes.delete(key)) } };
    const button = () => ({ attrs: {}, handlers: {}, setAttribute(key, value) { this.attrs[key] = value; }, addEventListener(type, callback) { this.handlers[type] = callback; }, focus() {} });
    const toggle = button(), pin = button(), activity = {};
    const context = { playerStage: stage, playerControls: { inert: false, contains: () => false, matches: () => false }, document: { fullscreenElement: stage, activeElement: null },
        fullscreenControlsToggleButton: toggle, fullscreenControlsPinButton: pin, fullscreenControlsPinned: false, fullscreenControlsManuallyHidden: false, fullscreenControlsIdleTimer: null,
        fullscreenMessageInput: {}, messageInput: {}, isSeekingPlayback: false,
        playerWebview: { addEventListener: (type, callback) => { activity[type] = callback; } },
        localStorage: { setItem: (key, value) => saved.set(key, value) },
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) };
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf("function updateFullscreenControlsButtons("), source.indexOf('["pointermove", "pointerdown", "keydown", "wheel"].forEach')), context);
    const idle = () => { const [id, callback] = [...timers].at(-1); timers.delete(id); callback(); };
    return { context, stage, toggle, pin, activity, saved, timers, idle };
}
test("fullscreen controls auto-hide and wake on activity inside the native player", () => {
    const { context, stage, toggle, activity, idle } = fixture();
    context.setFullscreenControlsActive(); idle();
    assert.equal(stage.classList.contains("is-fullscreen-controls-idle"), true);
    assert.equal(context.playerControls.inert, true); assert.equal(toggle.textContent, "Show controls");
    activity["ipc-message"]({ channel: "watch-party-player-activity" });
    assert.equal(stage.classList.contains("is-fullscreen-controls-idle"), false);
    assert.equal(context.playerControls.inert, false);
});
test("manual Hide remains hidden until Show is explicitly chosen", () => {
    const { context, stage, toggle, activity } = fixture();
    context.setFullscreenControlsActive();
    toggle.handlers.click({ stopPropagation() {} });
    activity["ipc-message"]({ channel: "watch-party-player-activity" });
    assert.equal(stage.classList.contains("is-fullscreen-controls-idle"), true);
    toggle.handlers.click({ stopPropagation() {} });
    assert.equal(stage.classList.contains("is-fullscreen-controls-idle"), false);
    assert.equal(toggle.attrs["aria-expanded"], "true");
});
test("Keep visible persists, disables the idle timer, and fullscreen exit restores keyboard access", () => {
    const { context, pin, timers, saved } = fixture();
    context.setFullscreenControlsActive(); pin.handlers.click();
    assert.equal(timers.size, 0); assert.equal(saved.get("watchPartyKeepControls"), "true");
    assert.equal(pin.attrs["aria-pressed"], "true");
    context.hideFullscreenControls(true); context.document.fullscreenElement = null; context.clearFullscreenControlsIdle();
    assert.equal(context.playerControls.inert, false); assert.equal(context.fullscreenControlsManuallyHidden, false);
});
test("playing title is plain text and clears on stop", () => {
    const context = { playingTitleEl: {}, nowPlayingEl: {} }; vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf("function setPlayingTitle("), source.indexOf("function isSameVideoUrl(")), context);
    context.setPlayingTitle("Episode 01 <test>.mkv");
    assert.equal(context.playingTitleEl.textContent, "Episode 01 <test>.mkv"); assert.equal(context.nowPlayingEl.hidden, false);
    context.setPlayingTitle(""); assert.equal(context.nowPlayingEl.hidden, true);
});
