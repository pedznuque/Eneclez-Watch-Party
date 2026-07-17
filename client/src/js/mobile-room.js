const APP_SERVER_ORIGIN = window.location.origin;
const socket = io(APP_SERVER_ORIGIN);
const params = new URLSearchParams(window.location.search);
const roomCode = params.get("room");
const shouldCreateRoom = params.get("create") === "1";
const username = localStorage.getItem("username") || "Guest";

const roomLoading = document.getElementById("roomLoading");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const playerFrame = document.getElementById("playerFrame");
const playerEmpty = document.getElementById("playerEmpty");
const playPauseButton = document.getElementById("playPause");
const progressEl = document.getElementById("progress");
const timeText = document.getElementById("timeText");
const hostText = document.getElementById("hostText");
const mediaUrlInput = document.getElementById("mediaUrl");
const mediaStatus = document.getElementById("mediaStatus");
const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("message");
const typingEl = document.getElementById("typing");
const peopleToggle = document.getElementById("peopleToggle");
const peoplePanel = document.getElementById("peoplePanel");
const guestCount = document.getElementById("guestCount");
const queueList = document.getElementById("queueList");
const queueCount = document.getElementById("queueCount");

let currentHost = "";
let controllers = new Set();
let queueItems = [];
let playbackState = null;
let selectedVideoUrl = "";
let isSeeking = false;
let typingTimer = null;
let broadcastTimer = null;

roomCodeLabel.textContent = roomCode || "------";

function setLoading(isLoading) {
    roomLoading.hidden = !isLoading;
}

function canControl() {
    return username === currentHost || controllers.has(username);
}

function formatTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getYoutubeVideoId(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        const parts = parsed.pathname.split("/").filter(Boolean);

        if (parsed.searchParams.has("v")) return parsed.searchParams.get("v") || "";
        if (host === "youtu.be") return parts[0] || "";
        if (["shorts", "embed", "live"].includes(parts[0])) return parts[1] || "";
        return "";
    } catch {
        return "";
    }
}

function getDailymotionVideoId(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        const parts = parsed.pathname.split("/").filter(Boolean);

        if (host === "dai.ly") return parts[0] || "";
        if (parts[0] === "video") return parts[1] || "";
        if (parts[0] === "embed" && parts[1] === "video") return parts[2] || "";
        return "";
    } catch {
        return "";
    }
}

function isYoutubeUrl(url) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host === "youtube-nocookie.com";
    } catch {
        return false;
    }
}

function isDailymotionUrl(url) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        return host === "dailymotion.com" || host.endsWith(".dailymotion.com") || host === "dai.ly";
    } catch {
        return false;
    }
}

function isFacebookUrl(url) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch";
    } catch {
        return false;
    }
}

function supportedUrl(url) {
    return isYoutubeUrl(url) || isDailymotionUrl(url) || isFacebookUrl(url);
}

function getPlayerUrl(url) {
    if (isYoutubeUrl(url)) {
        const videoId = getYoutubeVideoId(url);
        return videoId ? `/youtube-player.html?videoId=${encodeURIComponent(videoId)}` : url;
    }

    if (isDailymotionUrl(url)) {
        const videoId = getDailymotionVideoId(url);
        return videoId ? `https://www.dailymotion.com/embed/video/${encodeURIComponent(videoId)}?autoplay=1&controls=1` : url;
    }

    if (isFacebookUrl(url)) {
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&mute=false`;
    }

    return url;
}

function normalizeInputUrl(value) {
    const raw = value.trim();
    if (!raw) return "";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function titleFromUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, "");
    } catch {
        return "Video";
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function loadPlayer(url) {
    selectedVideoUrl = url;
    playerFrame.hidden = false;
    playerEmpty.hidden = true;
    playerFrame.src = getPlayerUrl(url);
    playPauseButton.disabled = !canControl();
    progressEl.disabled = !canControl();
}

function updatePlaybackDisplay(state) {
    if (!state) return;

    const duration = Number(state.duration) || 0;
    const currentTime = Number(state.currentTime) || 0;
    timeText.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    playPauseButton.textContent = state.paused === false ? "II" : ">";

    if (!isSeeking) {
        progressEl.value = duration > 0
            ? String(Math.min(1000, Math.max(0, Math.round((currentTime / duration) * 1000))))
            : "0";
    }
}

function getLocalPlayer() {
    try {
        return playerFrame.contentWindow?.watchPartyPlayer || null;
    } catch {
        return null;
    }
}

async function readLocalPlaybackState() {
    const player = getLocalPlayer();
    if (!player?.getState) return null;
    return player.getState();
}

async function setLocalPaused(paused) {
    const player = getLocalPlayer();
    if (!player?.setPaused) return;
    return player.setPaused(paused);
}

async function seekLocal(seconds, resume) {
    const player = getLocalPlayer();
    if (!player?.seekTo) return;
    return player.seekTo(seconds, resume);
}

function emitPlaybackState(state) {
    if (!state || !canControl()) return;

    socket.emit("mediaControl", {
        room: roomCode,
        username,
        currentTime: state.currentTime,
        duration: state.duration,
        paused: state.paused,
        updatedAt: Date.now()
    });
}

function startBroadcasting() {
    clearInterval(broadcastTimer);
    broadcastTimer = setInterval(async () => {
        if (!canControl() || !selectedVideoUrl) return;
        const state = await readLocalPlaybackState();
        if (state?.ready) emitPlaybackState(state);
    }, 1200);
}

function appendMessage(data) {
    const item = document.createElement("article");
    item.className = `mobile-message${data.username === username ? " is-mine" : ""}`;
    item.innerHTML = `
        <div class="mobile-message-meta">
            <strong></strong>
            <span>${new Date(data.sentAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <p></p>
    `;
    item.querySelector("strong").textContent = data.username || "Guest";
    item.querySelector("p").textContent = data.message || "";
    messagesEl.appendChild(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendSystem(message) {
    const item = document.createElement("div");
    item.className = "mobile-system";
    item.textContent = message;
    messagesEl.appendChild(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderQueue(items) {
    queueItems = Array.isArray(items) ? items : [];
    queueCount.textContent = String(queueItems.length);
    queueList.innerHTML = "";

    if (!queueItems.length) {
        queueList.innerHTML = `<div class="mobile-system">Nothing queued</div>`;
        return;
    }

    queueItems.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "mobile-queue-item";
        const canRemove = canControl() || item.addedBy === username;
        row.innerHTML = `
            <div>
                <strong>${index + 1}. ${escapeHtml(item.title || "Queued video")}</strong>
                <span>Added by ${escapeHtml(item.addedBy || "Guest")}</span>
            </div>
            <div class="mobile-queue-actions">
                <button class="secondary-action" type="button">Play</button>
                ${canRemove ? `<button class="danger-action" type="button">Remove</button>` : ""}
            </div>
        `;
        row.querySelector(".secondary-action").addEventListener("click", () => {
            if (!canControl()) return;
            socket.emit("loadMedia", { room: roomCode, username, url: item.url, title: item.title || "Video" });
            socket.emit("removeQueue", { room: roomCode, id: item.id });
        });
        row.querySelector(".danger-action")?.addEventListener("click", () => {
            socket.emit("removeQueue", { room: roomCode, id: item.id });
        });
        queueList.appendChild(row);
    });
}

function joinRoom() {
    if (!roomCode) {
        location.href = "/mobile";
        return;
    }

    socket.emit("joinRoom", {
        room: roomCode,
        username,
        create: shouldCreateRoom
    });
}

socket.on("connect", joinRoom);

socket.on("roomError", message => {
    setLoading(false);
    mediaStatus.textContent = message || "Unable to join room.";
});

socket.on("roomUsers", data => {
    setLoading(false);
    currentHost = data.host || "";
    controllers = new Set(Array.isArray(data.controllers) ? data.controllers : []);
    const users = Array.isArray(data.users) ? data.users : [];

    guestCount.textContent = String(users.length);
    hostText.textContent = username === currentHost ? "You are host" : canControl() ? "You can control" : `Host: ${currentHost || "Waiting"}`;
    playPauseButton.disabled = !canControl() || !selectedVideoUrl;
    progressEl.disabled = !canControl() || !selectedVideoUrl;

    peoplePanel.innerHTML = "";
    users.forEach(user => {
        const row = document.createElement("div");
        row.className = "mobile-user";
        row.innerHTML = `<strong></strong><span>${user === currentHost ? "Host" : controllers.has(user) ? "Controller" : "Guest"}</span>`;
        row.querySelector("strong").textContent = user;
        peoplePanel.appendChild(row);
    });

    renderQueue(queueItems);
    startBroadcasting();
});

socket.on("chat", appendMessage);
socket.on("system", appendSystem);

socket.on("typing", data => {
    typingEl.textContent = `${data.username} is typing...`;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        typingEl.textContent = "";
    }, 1200);
});

socket.on("mediaLoaded", media => {
    mediaStatus.textContent = media?.title ? `Loaded ${media.title}` : "Video loaded";
    if (media?.url) loadPlayer(media.url);
});

socket.on("mediaStopped", () => {
    selectedVideoUrl = "";
    playerFrame.src = "about:blank";
    playerFrame.hidden = true;
    playerEmpty.hidden = false;
    playPauseButton.disabled = true;
    progressEl.disabled = true;
});

socket.on("mediaPlayback", async state => {
    playbackState = state;
    updatePlaybackDisplay(state);

    if (!selectedVideoUrl || canControl()) return;

    const local = await readLocalPlaybackState();
    if (!local?.ready) return;

    const targetTime = Number(state.currentTime) || 0;
    const localTime = Number(local.currentTime) || 0;
    if (Math.abs(targetTime - localTime) > 2.2) {
        await seekLocal(targetTime, state.paused === false);
    }
    await setLocalPaused(state.paused !== false);
});

socket.on("queueUpdated", renderQueue);

document.getElementById("playNow").addEventListener("click", () => {
    const url = normalizeInputUrl(mediaUrlInput.value);
    if (!supportedUrl(url)) {
        mediaStatus.textContent = "Paste a supported video link.";
        return;
    }
    if (!canControl()) {
        mediaStatus.textContent = "Ask host for control.";
        return;
    }
    socket.emit("loadMedia", { room: roomCode, username, url, title: titleFromUrl(url) });
});

document.getElementById("addQueue").addEventListener("click", () => {
    const url = normalizeInputUrl(mediaUrlInput.value);
    if (!supportedUrl(url)) {
        mediaStatus.textContent = "Paste a supported video link.";
        return;
    }
    socket.emit("addQueue", { room: roomCode, username, url, title: titleFromUrl(url) });
    mediaStatus.textContent = "Added to queue.";
    mediaUrlInput.value = "";
});

playPauseButton.addEventListener("click", async () => {
    if (!canControl()) return;
    const state = await readLocalPlaybackState();
    const nextState = await setLocalPaused(state?.paused === false);
    emitPlaybackState(nextState || await readLocalPlaybackState());
});

progressEl.addEventListener("input", () => {
    isSeeking = true;
});

progressEl.addEventListener("change", async () => {
    if (!canControl()) return;
    const duration = Number(playbackState?.duration) || 0;
    const target = duration * (Number(progressEl.value) / 1000);
    const nextState = await seekLocal(target, playbackState?.paused === false);
    emitPlaybackState(nextState || await readLocalPlaybackState());
    isSeeking = false;
});

document.getElementById("chatForm").addEventListener("submit", event => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    socket.emit("chat", { room: roomCode, username, message });
    messageInput.value = "";
});

messageInput.addEventListener("input", () => {
    socket.emit("typing", { room: roomCode, username });
});

peopleToggle.addEventListener("click", () => {
    peoplePanel.hidden = !peoplePanel.hidden;
});

window.addEventListener("beforeunload", () => {
    socket.emit("leaveRoom");
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/mobile/sw.js").catch(() => {});
    });
}
