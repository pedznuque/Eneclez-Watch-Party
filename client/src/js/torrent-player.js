const video = document.getElementById("video");
const status = document.getElementById("status");
let desiredPaused = false;
let pendingTime = null;
let failure = "";
let compatibility = false;
let converting = false;
let duration = 0;
let offset = 0;
let lastSeek = -1;
let restarting = false;
let selectedSubtitle = null;
let mediaInfoTask = null;
const startedAt = Date.now();

function getMediaInfo() {
    if (!mediaInfoTask) mediaInfoTask = (async () => {
        const response = await fetch(new URL(`media-info${location.search}`, location.href), { signal: AbortSignal.timeout(35000) });
        const info = await response.json();
        if (!response.ok) throw new Error(info.error || "Could not inspect video codecs");
        return info;
    })().catch(error => { mediaInfoTask = null; throw error; });
    return mediaInfoTask;
}

function bufferedSeconds() {
    const time = video.currentTime || 0;
    for (let index = 0; index < video.buffered.length; index++) {
        if (video.buffered.start(index) <= time + 0.2 && video.buffered.end(index) > time) {
            return video.buffered.end(index) - time;
        }
    }
    return 0;
}

function loadConverted(time) {
    offset = Math.max(0, duration ? Math.min(duration, time) : time);
    restarting = true;
    failure = "";
    lastSeek = Date.now();
    const url = new URL(`transcode${location.search}`, location.href);
    url.searchParams.set("start", offset);
    if (selectedSubtitle?.kind === "bitmap") url.searchParams.set("subtitle", selectedSubtitle.index);
    video.src = url.href;
    video.load();
    status.textContent = "Preparing compatible H.264/AAC stream...";
    status.hidden = false;
}

async function startCompatibility() {
    if (converting || compatibility) return;
    converting = true;
    status.textContent = "Checking video codecs and preparing compatibility playback...";
    status.hidden = false;
    try {
        const info = await getMediaInfo();
        duration = info.duration;
        compatibility = true;
        failure = "";
        loadConverted(pendingTime ?? 0);
        pendingTime = null;
    } catch (error) { failure = error.message; status.textContent = failure; }
    finally { converting = false; }
}

async function applyDesiredState() {
    // Pause immediately, including while a previous play request is buffering.
    if (desiredPaused) video.pause();
    if (video.readyState < 1) return;
    if (pendingTime !== null && Number.isFinite(video.duration)) {
        video.currentTime = Math.max(0, Math.min(video.duration, pendingTime));
        pendingTime = null;
    }
    if (!desiredPaused) {
        await video.play().catch(() => {});
        if (desiredPaused) video.pause();
    }
}

window.watchPartyPlayer = {
    getMediaInfo,
    async setSubtitleTrack(track) {
        const currentTime = this.getState().currentTime;
        const previousBitmap = selectedSubtitle?.kind === "bitmap";
        selectedSubtitle = track;
        if (track?.kind === "bitmap" && !compatibility) {
            pendingTime = currentTime;
            await startCompatibility();
        } else if (compatibility && (previousBitmap || track?.kind === "bitmap")) loadConverted(currentTime);
        await applyDesiredState();
    },
    getState() { return {
        currentTime: pendingTime ?? (offset + (restarting ? 0 : video.currentTime || 0)),
        duration: compatibility ? duration : Number.isFinite(video.duration) ? video.duration : 0,
        paused: desiredPaused,
        ended: video.ended && !restarting,
        ready: video.readyState >= 2 && !converting && !restarting,
        seeking: restarting || video.seeking || pendingTime !== null,
        buffering: video.readyState < 3 || converting || restarting,
        error: failure
    }; },
    setVolume(value) { video.volume = Math.max(0, Math.min(100, Number(value) || 0)) / 100; video.muted = video.volume === 0; },
    setQuality(quality) { return quality === "auto"; },
    async setPaused(paused) { desiredPaused = Boolean(paused); await applyDesiredState(); return this.getState(); },
    async seekTo(time, resume, options = {}) {
        desiredPaused = !resume;
        if (Number.isFinite(Number(time))) {
            const target = Math.max(0, Number(time));
            if (compatibility) {
                // A room heartbeat advances while the converter is still buffering.
                // Do not keep canceling that same seek to chase the room clock.
                const expected = offset + (resume ? Math.max(0, Date.now() - lastSeek) / 1000 : 0);
                if (options.sync && restarting && Math.abs(target - expected) <= 3) {
                    await applyDesiredState();
                    return this.getState();
                }
                const localTime = target - offset;
                const buffered = Array.from({ length: video.buffered.length }, (_, index) => ({ start: video.buffered.start(index), end: video.buffered.end(index) }));
                if (!restarting && buffered.some(range => localTime >= range.start && localTime < range.end)) {
                    try { video.currentTime = localTime; }
                    catch { loadConverted(target); }
                } else if (!restarting || Math.abs(target - offset) > 0.25) loadConverted(target);
            } else pendingTime = target;
        }
        await applyDesiredState();
        return this.getState();
    }
};
video.addEventListener("loadedmetadata", applyDesiredState);
video.addEventListener("canplay", () => { restarting = false; applyDesiredState(); });
video.addEventListener("ended", () => { if (!restarting) desiredPaused = true; });
video.addEventListener("playing", () => { status.hidden = true; });
video.addEventListener("waiting", () => { status.hidden = false; });
video.addEventListener("error", () => {
    const code = video.error?.code;
    if (code === 1) return;
    if (!compatibility && (code === 3 || code === 4)) { startCompatibility(); return; }
    failure = code === 2 ? "The torrent video connection failed. Check available peers and retry." : "Compatibility playback failed. Check available torrent peers and retry the video.";
    status.textContent = failure;
    status.hidden = false;
});
video.src = new URL(`stream${location.search}`, location.href).href;
let statusFailures = 0, statusRequestBusy = false;
const statusTimer = setInterval(async () => {
    if (statusRequestBusy) return;
    statusRequestBusy = true;
    try {
        const response = await fetch(new URL(`status${location.search}`, location.href), { signal: AbortSignal.timeout(5000) });
        if (response.status === 410) {
            failure = "Torrent transfer stopped. Retry the video to reconnect.";
            status.textContent = failure; status.hidden = false; clearInterval(statusTimer); return;
        }
        if (!response.ok) throw new Error("Torrent transfer stopped");
        const data = await response.json();
        statusFailures = 0;
        if (data.error) throw new Error(data.error);
        if (data.conversionError) throw new Error(data.conversionError);
        if (!failure) {
            const fileIndex = Number(new URLSearchParams(location.search).get("file"));
            const file = data.files?.find(entry => entry.index === fileIndex);
            const needsData = !file || file.downloaded < file.length;
            const waiting = needsData && data.peers === 0 && data.downloadSpeed === 0 && bufferedSeconds() < 3 && Date.now() - startedAt > 15000;
            status.textContent = waiting ? "Waiting for seeders. A torrent file can load metadata faster, but video playback still needs a reachable seed or web seed." : `${converting ? "Checking codecs" : compatibility ? "Compatibility stream" : "Buffering opening pieces"} · ${data.peers} peers · ${formatTorrentSpeed(data.downloadSpeed)}`;
            if (!waiting) {
                const total = compatibility ? duration : video.duration;
                const sourceRate = file && Number.isFinite(total) && total > 0 ? file.length / total : 0;
                status.textContent += ` · ${bufferedSeconds().toFixed(1)}s buffered`;
                if (needsData && sourceRate > data.downloadSpeed && bufferedSeconds() < 3) {
                    status.textContent += ` · Source averages ${formatTorrentSpeed(sourceRate)}; waiting for more data`;
                }
            }
        }
    } catch (error) {
        if (++statusFailures >= 3 && !failure) {
            status.textContent = "Transfer status is temporarily unavailable. Retrying…";
            if (video.readyState < 3) status.hidden = false;
        }
    } finally { statusRequestBusy = false; }
}, 1500);
window.addEventListener("pagehide", () => clearInterval(statusTimer));
