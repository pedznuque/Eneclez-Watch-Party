const torrentStatus = document.getElementById("torrentStatus");
const torrentFile = document.getElementById("torrentFile");
const torrentUi = Object.fromEntries(["loadTorrent", "chooseTorrentFile", "stopTorrent", "playTorrent", "queueTorrent", "torrentLibrary", "torrentBadge", "torrentSearch", "torrentFileCount", "torrentFileInfo", "torrentDownload", "torrentDownloadBits", "torrentUpload", "torrentUploadBits", "torrentPeers", "torrentCached", "torrentCacheSize", "torrentProgress", "torrentPermissionHint"].map(id => [id, document.getElementById(id)]));
let loadedTorrent = null;
let torrentBusy = false;
let torrentStopping = false;
let torrentSelectionBusy = false;
let torrentRequestVersion = 0;
let torrentSelectionVersion = 0;
let torrentPollBusy = false;
let torrentSelectedIndex = null;

function torrentBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
function torrentMessage(message, state = "idle", badge = "Not connected") {
    torrentStatus.textContent = message;
    torrentStatus.dataset.state = state;
    torrentUi.torrentBadge.textContent = badge;
    torrentUi.torrentBadge.dataset.state = state;
}
function refreshTorrentControls() {
    const hasFile = Boolean(loadedTorrent && !torrentFile.disabled && torrentFile.value !== "");
    torrentUi.loadTorrent.disabled = torrentBusy || torrentStopping;
    torrentUi.chooseTorrentFile.disabled = torrentBusy || torrentStopping;
    torrentUi.stopTorrent.disabled = torrentStopping || (!loadedTorrent && !torrentBusy);
    torrentUi.playTorrent.disabled = !hasFile || torrentBusy || torrentSelectionBusy || !canControlPlayer();
    torrentUi.queueTorrent.disabled = !hasFile || torrentBusy || torrentSelectionBusy;
    torrentUi.torrentPermissionHint.textContent = loadedTorrent && !canControlPlayer() ? "Ask the host to allow playback control." : "";
    torrentUi.loadTorrent.textContent = torrentBusy ? "Finding videos…" : "Find videos";
}
window.refreshTorrentControls = refreshTorrentControls;

function updateTorrentStats(status = {}) {
    const showRate = (rate, value, bits) => {
        const formatted = formatTorrentSpeed(rate);
        value.textContent = formatted.split(" (")[0];
        bits.textContent = formatted.match(/\((.*)\)/)?.[1] || "0.00 Mbps";
    };
    showRate(status.downloadSpeed || 0, torrentUi.torrentDownload, torrentUi.torrentDownloadBits);
    showRate(status.uploadSpeed || 0, torrentUi.torrentUpload, torrentUi.torrentUploadBits);
    torrentUi.torrentPeers.textContent = String(status.peers || 0);
    const file = (status.files || loadedTorrent?.files || []).find(file => file.index === torrentSelectedIndex);
    const cached = Math.max(0, Math.min(file?.length || 0, Number(file?.downloaded) || 0));
    const percent = file?.length ? Math.min(100, cached / file.length * 100) : 0;
    torrentUi.torrentCached.textContent = `${Math.floor(percent)}%`;
    torrentUi.torrentCacheSize.textContent = file ? `${torrentBytes(cached)} / ${torrentBytes(file.length)}` : "Selected video only";
    torrentUi.torrentProgress.value = percent;
    torrentUi.torrentFileInfo.textContent = file ? `${torrentBytes(file.length)} · ${file.name.split(".").pop().toUpperCase()} video · ${Math.floor(percent)}% cached` : "No matching videos. Try another search.";
    if (file) torrentFile.title = file.name;
}

function renderTorrentFiles() {
    const query = torrentUi.torrentSearch.value.trim().toLowerCase();
    const files = (loadedTorrent?.files || []).filter(file => file.name.toLowerCase().includes(query));
    torrentFile.replaceChildren();
    for (const file of files) {
        const option = document.createElement("option");
        option.value = String(file.index);
        option.textContent = file.name;
        torrentFile.append(option);
    }
    const preferred = files.find(file => file.index === torrentSelectedIndex) || files[0];
    torrentSelectedIndex = preferred?.index ?? null;
    if (preferred) torrentFile.value = String(preferred.index);
    torrentFile.disabled = !files.length;
    torrentUi.torrentFileCount.textContent = `${files.length} of ${loadedTorrent?.files?.length || 0} videos`;
    torrentUi.torrentLibrary.hidden = !loadedTorrent;
    updateTorrentStats(loadedTorrent || {});
    refreshTorrentControls();
}

function displayTorrent(result) {
    loadedTorrent = result?.ok ? result : null;
    torrentSelectedIndex = loadedTorrent?.preferredFileIndex ?? loadedTorrent?.files?.[0]?.index ?? null;
    torrentUi.torrentSearch.value = "";
    renderTorrentFiles();
    torrentMessage(loadedTorrent?.files?.length ? "Choose a video below, then play it with your room." : result?.error || "No supported videos found in this torrent.", loadedTorrent?.files?.length ? "ready" : "error", loadedTorrent?.files?.length ? "Ready to stream" : "Not connected");
}

async function prepareTorrentPanel(pickFile) {
    if (torrentBusy || torrentStopping) return;
    const version = ++torrentRequestVersion;
    ++torrentSelectionVersion;
    torrentBusy = true;
    torrentSelectionBusy = false;
    torrentMessage("Finding peers and loading the video list…", "loading", "Connecting");
    refreshTorrentControls();
    try {
        if (!window.watchParty?.prepareTorrent) throw new Error("Torrent streaming requires the updated desktop app.");
        const magnet = document.getElementById("torrentMagnet").value.trim();
        if (!pickFile && !parseTorrentLink(magnet)) throw new Error("Paste a valid BitTorrent magnet link.");
        const result = pickFile ? await window.watchParty.chooseTorrentFile() : await window.watchParty.prepareTorrent({ magnet });
        if (version !== torrentRequestVersion) return;
        if (result?.canceled) {
            torrentMessage(loadedTorrent ? "Your previous video list is still available." : "No torrent selected.", loadedTorrent ? "ready" : "idle", loadedTorrent ? "Ready to stream" : "Not connected");
            return;
        }
        displayTorrent(result);
    } catch (error) { if (version === torrentRequestVersion) torrentMessage(error.message, "error", "Needs attention"); }
    finally { if (version === torrentRequestVersion) { torrentBusy = false; refreshTorrentControls(); } }
}

function selectedTorrentLink() {
    if (!loadedTorrent || torrentFile.disabled || torrentBusy || torrentSelectionBusy) return "";
    const url = new URL(loadedTorrent.magnet);
    url.searchParams.set("wpFile", torrentFile.value);
    if (!parseTorrentLink(url.href)) { torrentMessage("This magnet is too long to share in a room.", "error", "Needs attention"); return ""; }
    return url.href;
}

async function prepareTorrentSelection() {
    torrentSelectedIndex = torrentFile.disabled ? null : Number(torrentFile.value);
    updateTorrentStats(loadedTorrent || {});
    if (!loadedTorrent || torrentSelectedIndex === null) { refreshTorrentControls(); return; }
    const version = ++torrentSelectionVersion, requestVersion = torrentRequestVersion;
    torrentSelectionBusy = true;
    torrentMessage("Preparing the selected video’s opening pieces…", "loading", "Preparing video");
    refreshTorrentControls();
    try {
        const result = await window.watchParty.prepareTorrent({ magnet: loadedTorrent.magnet, fileIndex: torrentSelectedIndex });
        if (version !== torrentSelectionVersion || requestVersion !== torrentRequestVersion) return;
        if (!result?.ok) throw new Error(result?.error || "Could not prepare this video.");
        loadedTorrent = result;
        updateTorrentStats(result);
        torrentMessage("Ready. Your video will be shared with the room.", "ready", "Ready to stream");
    } catch (error) { if (version === torrentSelectionVersion && requestVersion === torrentRequestVersion) torrentMessage(error.message, "error", "Needs attention"); }
    finally { if (version === torrentSelectionVersion && requestVersion === torrentRequestVersion) { torrentSelectionBusy = false; refreshTorrentControls(); } }
}

document.getElementById("browseTorrent").onclick = () => { setBrowserSite("torrent"); refreshTorrentControls(); };
document.getElementById("torrentForm").onsubmit = event => { event.preventDefault(); prepareTorrentPanel(false); };
torrentUi.chooseTorrentFile.onclick = () => prepareTorrentPanel(true);
torrentFile.onchange = prepareTorrentSelection;
torrentUi.torrentSearch.addEventListener("input", () => {
    const previous = torrentSelectedIndex;
    renderTorrentFiles();
    if (torrentSelectedIndex !== previous) prepareTorrentSelection();
});
torrentUi.playTorrent.onclick = () => { const url = selectedTorrentLink(); if (url) openPlayerFromUrl(url, torrentFile.selectedOptions[0]?.textContent); };
torrentUi.queueTorrent.onclick = () => { const url = selectedTorrentLink(); if (url) addQueueFromUrl(url, torrentFile.selectedOptions[0]?.textContent); };
torrentUi.stopTorrent.onclick = async () => {
    if (torrentStopping) return;
    ++torrentRequestVersion; ++torrentSelectionVersion;
    torrentStopping = true;
    torrentBusy = false; torrentSelectionBusy = false; loadedTorrent = null;
    renderTorrentFiles();
    torrentMessage("Stopping this device’s transfer…", "loading", "Stopping");
    try {
        await window.watchParty?.stopTorrent();
        torrentMessage("Transfer stopped. Cached pieces are kept; use Retry in the player to rejoin playback.", "idle", "Stopped");
    } catch (error) { torrentMessage(error.message, "error", "Could not stop"); }
    finally { torrentStopping = false; refreshTorrentControls(); }
};
const torrentPollTimer = setInterval(async () => {
    if (!loadedTorrent || torrentBusy || torrentPollBusy || document.getElementById("torrentPanel").hidden) return;
    const version = torrentRequestVersion;
    torrentPollBusy = true;
    try {
        const status = await window.watchParty.torrentStatus();
        if (version !== torrentRequestVersion) return;
        if (!status.ok) { displayTorrent({ error: "Transfer stopped. Load a torrent to reconnect." }); return; }
        if (status.hash !== loadedTorrent?.hash) return;
        loadedTorrent = { ...loadedTorrent, ...status };
        updateTorrentStats(status);
        if (!torrentSelectionBusy) torrentMessage(status.error || status.conversionError || (status.peers ? "Connected. Video pieces are buffered ahead of playback." : "Waiting for reachable peers. Cached pieces remain available."), status.error || status.conversionError ? "error" : "ready", status.error || status.conversionError ? "Needs attention" : status.peers ? "Connected" : "Waiting for peers");
    } catch (error) { if (version === torrentRequestVersion) torrentMessage(error.message, "error", "Needs attention"); }
    finally { torrentPollBusy = false; refreshTorrentControls(); }
}, 2000);
window.addEventListener("pagehide", () => { clearInterval(torrentPollTimer); ++torrentRequestVersion; window.watchParty?.stopTorrent().catch(() => {}); });
refreshTorrentControls();
