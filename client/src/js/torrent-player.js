const video = document.getElementById("video");
const status = document.getElementById("status");
const bufferPanel = document.getElementById("bufferingState");
const bufferTitle = document.getElementById("bufferTitle");
const bufferDetail = document.getElementById("bufferDetail");
const bufferProgress = document.getElementById("bufferProgress");
const readinessBadge = document.getElementById("readinessBadge");
let desiredPaused = false, pendingTime = null, failure = "";
let compatibility = false, converting = false, initializing = true;
let duration = 0, offset = 0, restarting = false, selectedSubtitle = null, mediaInfoTask = null;
let bufferingGate = true, hasBeenReady = false, remoteSync = null, waitingForRoom = false;
let playAttempt = null, needsGesture = false, disposed = false;
let mediaInfo = null, streamAbort = null, mediaObjectUrl = null;

function getMediaInfo() {
    if (!mediaInfoTask) mediaInfoTask = (async () => {
        const response = await fetch(new URL(`media-info${location.search}`, location.href), { signal: AbortSignal.timeout(95000) });
        const info = await response.json();
        if (!response.ok) throw new Error(info.error || "Could not inspect video codecs");
        return info;
    })().catch(error => { mediaInfoTask = null; throw error; });
    return mediaInfoTask;
}
function absoluteTime() { return pendingTime ?? offset + (restarting ? 0 : video.currentTime || 0); }
function totalDuration() { return duration || (Number.isFinite(video.duration) ? video.duration : 0); }
function clampTime(time) { return Math.max(0, totalDuration() ? Math.min(totalDuration(), time) : time); }
function syncTime() {
    if (!remoteSync) return absoluteTime();
    return clampTime(remoteSync.time + (remoteSync.paused ? 0 : (Date.now() - remoteSync.at) / 1000));
}
function bufferedSeconds(time = absoluteTime()) {
    const local = time - offset;
    for (let index = 0; index < video.buffered.length; index++) {
        if (video.buffered.start(index) <= local + .1 && video.buffered.end(index) > local) return video.buffered.end(index) - local;
    }
    return 0;
}
function bufferTarget(time = absoluteTime()) {
    const remaining = totalDuration() ? Math.max(0, totalDuration() - time - .15) : Infinity;
    return Math.min(hasBeenReady ? 5 : 8, remaining);
}
function decodedFrame() { return video.readyState >= 2 && video.videoWidth > 0 && !video.seeking; }
function stopMediaStream() {
    streamAbort?.abort(); streamAbort = null;
    if (mediaObjectUrl) { URL.revokeObjectURL(mediaObjectUrl); mediaObjectUrl = null; }
}
function loadMediaSource(url) {
    stopMediaStream();
    const mime = mediaInfo?.hasAudio ? 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"' : 'video/mp4; codecs="avc1.42E01E"';
    if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported(mime)) { video.src = url; video.load(); return; }
    const controller = new AbortController(); streamAbort = controller;
    const source = new MediaSource(); mediaObjectUrl = URL.createObjectURL(source);
    video.src = mediaObjectUrl; video.load();
    source.addEventListener("sourceopen", async () => {
        let reader;
        const change = (buffer, action) => new Promise((resolve, reject) => {
            const cleanup = () => { buffer.removeEventListener("updateend", done); buffer.removeEventListener("error", fail); controller.signal.removeEventListener("abort", fail); };
            const done = () => { cleanup(); resolve(); };
            const fail = () => { cleanup(); reject(new Error("Media buffer stopped")); };
            buffer.addEventListener("updateend", done, { once:true }); buffer.addEventListener("error", fail, { once:true }); controller.signal.addEventListener("abort", fail, { once:true });
            try { action(); } catch (error) { cleanup(); reject(error); }
        });
        try {
            const buffer = source.addSourceBuffer(mime);
            const response = await fetch(url, { signal:controller.signal });
            if (!response.ok) throw new Error("Video conversion could not start");
            reader = response.body.getReader();
            while (!controller.signal.aborted) {
                // Fetch independently of Chromium's paused-video preload limit,
                // but bound the conversion buffer for long movies.
                while (bufferedSeconds(offset + video.currentTime) > 45 && !controller.signal.aborted) await new Promise(resolve => setTimeout(resolve, 200));
                if (controller.signal.aborted) break;
                const chunk = await reader.read();
                if (chunk.done) { if (source.readyState === "open") source.endOfStream(); break; }
                if (video.currentTime > 40 && buffer.buffered.length && buffer.buffered.start(0) < video.currentTime - 35) await change(buffer, () => buffer.remove(0, video.currentTime - 30));
                await change(buffer, () => buffer.appendBuffer(chunk.value));
                updatePlayback();
            }
        } catch (error) {
            if (!controller.signal.aborted && !disposed) { failure = error.message || "Video buffer failed. Retry playback."; renderReadiness(); }
        } finally { await reader?.cancel().catch(() => {}); }
    }, { once:true });
}
function loadConverted(time) {
    offset = clampTime(time); pendingTime = null; restarting = true; bufferingGate = true; hasBeenReady = false;
    failure = ""; needsGesture = false;
    const url = new URL(`transcode${location.search}`, location.href);
    url.searchParams.set("start", offset);
    if (selectedSubtitle?.kind === "bitmap") url.searchParams.set("subtitle", selectedSubtitle.index);
    video.pause(); loadMediaSource(url.href);
}
async function startCompatibility(time = absoluteTime()) {
    if (converting) return;
    converting = true; video.pause(); bufferingGate = true;
    try {
        const info = await getMediaInfo(); duration = info.duration; compatibility = true; failure = "";
        if (!disposed) loadConverted(time);
    } catch (error) { failure = error.message; }
    finally { converting = false; }
}
function requestSeek(time) {
    const target = clampTime(time);
    bufferingGate = true; hasBeenReady = false; needsGesture = false;
    if (compatibility) {
        const local = target - offset;
        if (!restarting && bufferedSeconds(target) > .1 && local >= 0) video.currentTime = local;
        else loadConverted(target);
    } else {
        pendingTime = target;
        if (video.readyState >= 1 && Number.isFinite(video.duration)) { video.currentTime = target; pendingTime = null; }
    }
}
function phase() {
    if (failure) return "error";
    if (initializing || converting) return "checking";
    if (bufferingGate) return "buffering";
    if (waitingForRoom) return "waiting";
    if (needsGesture) return "gesture";
    return video.paused ? "ready" : "playing";
}
function renderReadiness() {
    const currentPhase = phase(), targetTime = bufferingGate && remoteSync ? syncTime() : absoluteTime();
    const buffered = bufferedSeconds(targetTime), target = bufferTarget(targetTime);
    if (bufferPanel) bufferPanel.hidden = !["checking", "buffering", "gesture"].includes(currentPhase);
    const playButton = document.getElementById("bufferPlayButton");
    if (playButton) playButton.hidden = currentPhase !== "gesture";
    if (bufferTitle) bufferTitle.textContent = currentPhase === "checking" ? "Preparing video and audio…" : currentPhase === "gesture" ? "Ready — click Play to enable audio" : "Buffering before playback";
    if (bufferDetail) bufferDetail.textContent = currentPhase === "checking" ? "Checking codecs so every viewer gets video and sound." : `${buffered.toFixed(1)} / ${target.toFixed(0)} seconds buffered. Playback waits for enough video.`;
    if (bufferProgress) bufferProgress.value = currentPhase === "checking" ? 0 : target > 0 ? Math.min(1, buffered / target) : 1;
    if (readinessBadge) {
        readinessBadge.textContent = currentPhase === "playing" ? "Playing" : currentPhase === "ready" ? "Video ready" : currentPhase === "waiting" ? "Video ready · Waiting for room" : currentPhase === "gesture" ? "Ready · Click Play" : currentPhase === "error" ? "Playback error" : currentPhase === "checking" ? "Checking video + audio" : `Buffering ${buffered.toFixed(1)} / ${target.toFixed(0)}s`;
        readinessBadge.dataset.state = currentPhase;
    }
    if (failure) { status.textContent = failure; status.hidden = false; }
}
function updatePlayback() {
    if (disposed) return;
    if (desiredPaused || bufferingGate || waitingForRoom) video.pause();
    if (!initializing && !converting && !failure) {
        if (pendingTime !== null && video.readyState >= 1 && Number.isFinite(video.duration)) {
            video.currentTime = clampTime(pendingTime); pendingTime = null;
        }
        if (!bufferingGate && !desiredPaused && !waitingForRoom && !video.ended && (video.readyState < 3 || bufferedSeconds() < .25)) {
            bufferingGate = true; video.pause();
        }
        const targetTime = bufferingGate && remoteSync ? syncTime() : absoluteTime();
        if (bufferingGate && !compatibility && video.networkState === 1 && decodedFrame() && bufferedSeconds(targetTime) + .1 < bufferTarget(targetTime)) {
            // Some native containers suspend preload after only two seconds.
            // Use the bounded conversion buffer instead of waiting forever.
            startCompatibility(targetTime); return;
        }
        if (bufferingGate && decodedFrame() && bufferedSeconds(targetTime) + .1 >= bufferTarget(targetTime)) {
            const local = targetTime - offset;
            if (local >= 0 && Math.abs((video.currentTime || 0) - local) > 1.15) {
                video.currentTime = local;
            } else {
                bufferingGate = false; restarting = false; hasBeenReady = true;
            }
        }
        if (!bufferingGate && !desiredPaused && !waitingForRoom && !needsGesture && video.paused && !playAttempt) {
            playAttempt = video.play().catch(error => {
                if (error.name === "NotAllowedError") needsGesture = true;
                else if (error.name !== "AbortError" && !compatibility) startCompatibility();
            }).finally(() => { playAttempt = null; if (desiredPaused || bufferingGate || waitingForRoom) video.pause(); renderReadiness(); });
        }
    }
    renderReadiness();
}

window.watchPartyPlayer = {
    getMediaInfo,
    getState() {
        const targetTime = bufferingGate && remoteSync ? syncTime() : absoluteTime();
        return { provider: "torrent", currentTime: absoluteTime(), duration: totalDuration(), paused: video.paused || bufferingGate || waitingForRoom,
            requestedPaused: desiredPaused, ended: video.ended && !restarting && !bufferingGate,
            ready: !initializing && !converting && !bufferingGate && decodedFrame(), seeking: restarting || video.seeking || pendingTime !== null,
            buffering: bufferingGate || initializing || converting, waitingForRoom, phase: phase(), bufferedSeconds: bufferedSeconds(targetTime), bufferTarget: bufferTarget(targetTime),
            videoWidth: video.videoWidth || 0, videoHeight: video.videoHeight || 0, error: failure };
    },
    async setSubtitleTrack(track) {
        const time = absoluteTime(), previousBitmap = selectedSubtitle?.kind === "bitmap";
        selectedSubtitle = track;
        if (!initializing && track?.kind === "bitmap" && !compatibility) await startCompatibility(time);
        else if (!initializing && compatibility && (previousBitmap || track?.kind === "bitmap")) loadConverted(time);
        updatePlayback();
    },
    setVolume(value) { video.volume = Math.max(0, Math.min(100, Number(value) || 0)) / 100; video.muted = video.volume === 0; },
    setQuality(quality) { return quality === "auto"; },
    async setPaused(paused) { desiredPaused = Boolean(paused); remoteSync = null; waitingForRoom = false; needsGesture = false; updatePlayback(); return this.getState(); },
    async seekTo(time, resume, options = {}) {
        if (options.sync) return this.syncTo(time, !resume);
        desiredPaused = !resume; remoteSync = null; waitingForRoom = false;
        if (Number.isFinite(Number(time))) requestSeek(Number(time));
        updatePlayback(); return this.getState();
    },
    async syncTo(time, paused, options = {}) {
        if (!Number.isFinite(Number(time))) return this.getState();
        const target = clampTime(Number(time));
        const expected = remoteSync ? syncTime() : absoluteTime();
        const discontinuity = Math.abs(target - expected) > 4 || target < offset - 1;
        remoteSync = { time: target, at: Date.now(), paused: Boolean(options.paused ?? paused) };
        desiredPaused = Boolean(paused); waitingForRoom = Boolean(options.buffering && options.paused);
        if (discontinuity) requestSeek(target);
        else if (!bufferingGate && Math.abs(target - absoluteTime()) > 1.15) {
            if (bufferedSeconds(target) >= bufferTarget(target)) video.currentTime = Math.max(0, target - offset);
            else bufferingGate = true;
        }
        updatePlayback(); return this.getState();
    }
};
for (const event of ["loadedmetadata", "canplay", "progress", "seeked"]) video.addEventListener(event, updatePlayback);
video.addEventListener("ended", () => { if (!restarting) desiredPaused = true; renderReadiness(); });
video.addEventListener("playing", () => { status.hidden = true; renderReadiness(); });
video.addEventListener("waiting", () => { if (!video.ended) { bufferingGate = true; video.pause(); } status.hidden = false; renderReadiness(); });
video.addEventListener("error", () => {
    if (video.error?.code === 1) return;
    if (!compatibility && !initializing) { startCompatibility(); return; }
    failure = "The video stream failed. Check peers and retry the video."; renderReadiness();
});
async function initializePlayback() {
    try {
        const info = await getMediaInfo(); mediaInfo = info; duration = info.duration;
        if (disposed) return;
        if (info.requiresCompatibility || selectedSubtitle?.kind === "bitmap") { compatibility = true; loadConverted(pendingTime ?? 0); }
        else { video.src = new URL(`stream${location.search}`, location.href).href; video.load(); }
    } catch (error) { failure = error.message; }
    finally { initializing = false; updatePlayback(); }
}
const readinessTimer = setInterval(updatePlayback, 250);
let statusFailures = 0, statusRequestBusy = false;
const statusTimer = setInterval(async () => {
    if (statusRequestBusy || disposed) return;
    statusRequestBusy = true;
    try {
        const response = await fetch(new URL(`status${location.search}`, location.href), { signal: AbortSignal.timeout(5000) });
        if (response.status === 410) { failure = "Torrent transfer stopped. Retry the video to reconnect."; renderReadiness(); clearInterval(statusTimer); return; }
        if (!response.ok) throw new Error("Transfer status unavailable");
        const data = await response.json(); statusFailures = 0;
        if (data.conversionError) {
            failure = data.conversionError; video.pause(); stopMediaStream(); renderReadiness(); return;
        }
        if (data.error) throw new Error(data.error);
        if (!failure) {
            status.textContent = `${data.peers} peers · ${formatTorrentSpeed(data.downloadSpeed)} · ${bufferedSeconds().toFixed(1)}s buffered`;
            if (!data.peers && !data.downloadSpeed && bufferingGate) status.textContent += " · Waiting for reachable seeders";
        }
    } catch {
        if (++statusFailures >= 3 && !failure) status.textContent = "Transfer status temporarily unavailable. Retrying…";
    } finally { statusRequestBusy = false; }
}, 1500);
window.addEventListener("pagehide", () => { disposed = true; stopMediaStream(); clearInterval(readinessTimer); clearInterval(statusTimer); });
document.getElementById("bufferPlayButton")?.addEventListener("click", () => { desiredPaused = false; needsGesture = false; updatePlayback(); });
initializePlayback();
