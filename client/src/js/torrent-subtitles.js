function parseSubtitleCues(text, start = 0) {
    const time = value => {
        const parts = value.replace(",", ".").split(":").map(Number);
        return parts.reduce((total, part) => total * 60 + part, 0);
    };
    return text.replace(/\r/g, "").split(/\n\s*\n/).flatMap(block => {
        const lines = block.trim().split("\n");
        const index = lines.findIndex(line => /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d+\s+-->/.test(line));
        if (index < 0) return [];
        const times = lines[index].match(/^([\d:.,]+)\s+-->\s+([\d:.,]+)/);
        if (!times) return [];
        const cueText = lines.slice(index + 1).join("\n").replace(/<[^>]*>/g, "")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
        return [{ start: start + time(times[1]), end: start + time(times[2]), text: cueText }];
    });
}

async function initializeTorrentSubtitles() {
    const select = document.getElementById("subtitleSelect");
    const caption = document.getElementById("subtitleText");
    const notice = document.getElementById("subtitleNotice");
    const retry = document.getElementById("subtitleRetry");
    const video = document.getElementById("video");
    const player = window.watchPartyPlayer;
    let tracks = [], selected = null, cues = [], request = null, nextRefresh = -1, previousTime = 0, retryAt = 0;
    let generation = 0;
    let selectionGeneration = 0, userSelected = false, metadataLoading = false;
    select.disabled = false;
    notice.textContent = "Finding subtitle tracks…";

    function render(time) {
        const text = cues.filter(cue => cue.start <= time && cue.end > time).map(cue => cue.text).join("\n");
        if (caption.textContent !== text) caption.textContent = text;
        caption.hidden = !text;
    }
    async function fetchCues(start) {
        const currentGeneration = ++generation;
        request?.abort();
        const controller = new AbortController();
        request = controller;
        nextRefresh = start + 90;
        cues = cues.filter(cue => cue.end >= start && cue.start < start);
        notice.textContent = "Loading subtitles...";
        const url = new URL(`subtitles${location.search}`, location.href);
        url.searchParams.set("subtitle", selected.index);
        url.searchParams.set("start", start);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error("Subtitle track could not load");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let pending = "";
            while (true) {
                const { value, done } = await reader.read();
                if (currentGeneration !== generation) { await reader.cancel(); return; }
                pending += decoder.decode(value, { stream: !done }).replace(/\r/g, "");
                const end = done ? pending.length : pending.lastIndexOf("\n\n");
                if (end >= 0) {
                    for (const cue of parseSubtitleCues(pending.slice(0, end))) {
                        if (!cues.some(existing => existing.start === cue.start && existing.end === cue.end && existing.text === cue.text)) cues.push(cue);
                    }
                    pending = pending.slice(end).replace(/^\n+/, "");
                    render(player.getState().currentTime);
                    if (cues.length) notice.textContent = "";
                }
                if (done) break;
            }
            notice.textContent = "";
        } catch (error) {
            if (controller.signal.aborted || currentGeneration !== generation) return;
            notice.textContent = "Subtitles interrupted; retrying...";
            retryAt = Date.now() + 10000;
            nextRefresh = -1;
        }
    }
    function update() {
        const time = player.getState().currentTime;
        if (selected?.kind === "text") {
            const jumped = Math.abs(time - previousTime) > 5;
            if ((time >= nextRefresh || jumped) && Date.now() >= retryAt) fetchCues(Math.max(0, time - 2));
            render(time);
        }
        previousTime = time;
    }
    async function changeSubtitle() {
        const selectionVersion = ++selectionGeneration;
        ++generation;
        request?.abort();
        selected = tracks.find(track => String(track.index) === select.value) || null;
        cues = []; caption.textContent = ""; caption.hidden = true; notice.textContent = "";
        nextRefresh = -1; retryAt = 0;
        try {
            await player.setSubtitleTrack(selected);
            if (selectionVersion === selectionGeneration) update();
        } catch {
            if (selectionVersion === selectionGeneration) notice.textContent = "Could not switch subtitles. Try another track or Off.";
        }
    }
    select.addEventListener("pointerdown", () => { userSelected = true; });
    select.addEventListener("change", () => { userSelected = true; changeSubtitle(); });
    const timer = setInterval(update, 500);
    video.addEventListener("timeupdate", update);
    window.addEventListener("pagehide", () => { ++generation; request?.abort(); clearInterval(timer); });
    async function loadTracks() {
    if (metadataLoading) return;
    metadataLoading = true;
    if (retry) retry.hidden = true;
    notice.textContent = "Finding subtitle tracks…";
    try {
        const info = await player.getMediaInfo();
        tracks = (info.subtitles || []).filter(track => track.kind !== "unsupported");
        while (select.options.length > 1) select.remove(1);
        for (const track of tracks) {
            const option = document.createElement("option");
            option.value = track.index;
            option.textContent = `${track.label}${track.kind === "bitmap" ? " (image)" : ""}`;
            select.append(option);
        }
        if (!tracks.length) { notice.textContent = "No embedded subtitle tracks"; return; }
        notice.textContent = "";
        const preferred = tracks.find(track => /^(eng|en)$/i.test(track.language) && track.default)
            || tracks.find(track => /^(eng|en)$/i.test(track.language)) || tracks.find(track => track.default) || tracks[0];
        if (!userSelected) {
            select.value = String(preferred.index);
            await changeSubtitle();
        }
    } catch { notice.textContent = "Subtitle information unavailable."; if (retry) retry.hidden = false; }
    finally { metadataLoading = false; }
    }
    if (retry) retry.onclick = loadTracks;
    await loadTracks();
}

if (typeof module !== "undefined" && module.exports) module.exports = { parseSubtitleCues };
if (typeof window !== "undefined" && window.watchPartyPlayer) initializeTorrentSubtitles();
