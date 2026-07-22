const SERVER_ORIGIN = "https://eneclez-watch-party.onrender.com";
const socket = io(SERVER_ORIGIN);

const lobbyView = document.getElementById("lobbyView");
const roomView = document.getElementById("roomView");
const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const createRoomButton = document.getElementById("createRoom");
const joinRoomButton = document.getElementById("joinRoom");
const lobbyStatus = document.getElementById("lobbyStatus");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const copyRoomButton = document.getElementById("copyRoom");
const leaveRoomButton = document.getElementById("leaveRoom");
const playerTab = document.getElementById("playerTab");
const browserTab = document.getElementById("browserTab");
const playerView = document.getElementById("playerView");
const browserView = document.getElementById("browserView");
const browserFrame = document.getElementById("browserFrame");
const browserEmpty = document.getElementById("browserEmpty");
const browserForm = document.getElementById("browserForm");
const browserUrlInput = document.getElementById("browserUrl");
const browserBackButton = document.getElementById("browserBack");
const browserForwardButton = document.getElementById("browserForward");
const browserReloadButton = document.getElementById("browserReload");
const browserQueuePanel = document.getElementById("browserQueuePanel");
const playerShell = document.getElementById("playerShell");
const nativeVideo = document.getElementById("nativeVideo");
const playerFrame = document.getElementById("playerFrame");
const playerFallback = document.getElementById("playerFallback");
const openExternalVideo = document.getElementById("openExternalVideo");
const emptyPlayer = document.getElementById("emptyPlayer");
const playPauseButton = document.getElementById("playPause");
const stopVideoButton = document.getElementById("stopVideo");
const mediaStatus = document.getElementById("mediaStatus");
const mediaUrlInput = document.getElementById("mediaUrl");
const loadMediaButton = document.getElementById("loadMedia");
const addQueueButton = document.getElementById("addQueue");
const queueCount = document.getElementById("queueCount");
const queueList = document.getElementById("queueList");
const guestCount = document.getElementById("guestCount");
const messages = document.getElementById("messages");
const typing = document.getElementById("typing");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const browserSiteButtons = Array.from(document.querySelectorAll(".browser-site"));

const BROWSER_URLS = {
  youtube: "https://m.youtube.com/",
  bilibili: "https://m.bilibili.com/",
  dailymotion: "https://www.dailymotion.com/",
  facebook: "https://m.facebook.com/watch/"
};

let username = localStorage.getItem("watchPartyMobileName") || "";
let roomCode = "";
let pendingRoomCode = "";
let queueItems = [];
let currentMedia = null;
let currentPlayerMode = "empty";
let currentPlayerUrl = "";
let browserHistory = [];
let browserHistoryIndex = -1;
let typingTimer = null;

nameInput.value = username;

function setLobbyStatus(text) {
  lobbyStatus.textContent = text || "";
}

function setMediaStatus(text) {
  mediaStatus.textContent = text || "";
}

function setRoomTab(tab) {
  const isBrowser = tab === "browser";
  playerTab.classList.toggle("is-active", !isBrowser);
  browserTab.classList.toggle("is-active", isBrowser);
  playerView.hidden = isBrowser;
  browserView.hidden = !isBrowser;

  if (isBrowser && !browserFrame.src) {
    loadBrowserSite("youtube");
  }
}

function loadBrowserSite(site) {
  const url = BROWSER_URLS[site] || BROWSER_URLS.youtube;
  browserSiteButtons.forEach(button => {
    button.classList.toggle("is-active", button.dataset.site === site);
  });
  navigateBrowser(url);
}

function browserSearchUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return BROWSER_URLS.youtube;

  if (/^https?:\/\//i.test(raw)) return raw;

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) {
    return `https://${raw}`;
  }

  return `https://m.youtube.com/results?search_query=${encodeURIComponent(raw)}`;
}

function updateBrowserControls() {
  browserBackButton.disabled = browserHistoryIndex <= 0;
  browserForwardButton.disabled = browserHistoryIndex >= browserHistory.length - 1;
  browserUrlInput.value = browserHistory[browserHistoryIndex] || "";
}

function navigateBrowser(url, { replace = false } = {}) {
  const nextUrl = normalizeUrl(url);
  if (!nextUrl) return;

  if (replace && browserHistoryIndex >= 0) {
    browserHistory[browserHistoryIndex] = nextUrl;
  } else {
    browserHistory = browserHistory.slice(0, browserHistoryIndex + 1);
    browserHistory.push(nextUrl);
    browserHistoryIndex = browserHistory.length - 1;
  }

  browserFrame.src = nextUrl;
  browserEmpty.hidden = true;
  updateBrowserControls();
}

function getBrowserCurrentUrl() {
  return browserHistory[browserHistoryIndex] || browserUrlInput.value.trim() || "";
}

function sendBrowserPageToRoom(action) {
  const url = normalizeUrl(getBrowserCurrentUrl());
  if (!url || !roomCode) return;

  const payload = {
    room: roomCode,
    username,
    url,
    title: titleFromUrl(url)
  };

  socket.emit(action === "queue" ? "addQueue" : "loadMedia", payload);
  setMediaStatus(action === "queue" ? "Queued from browser" : "Playing from browser");
  if (action !== "queue") {
    setRoomTab("player");
  }
}

function sendNativeBrowserResult(result) {
  const action = result?.action;
  const url = normalizeUrl(result?.url);
  if (!url || !roomCode || (action !== "play" && action !== "queue")) return;

  const payload = {
    room: roomCode,
    username,
    url,
    title: result?.title || titleFromUrl(url)
  };

  socket.emit(action === "queue" ? "addQueue" : "loadMedia", payload);
  setMediaStatus(action === "queue" ? "Queued from native browser" : "Playing from native browser");
  setRoomTab("player");
}

async function openNativeBrowser(startUrl) {
  const nativeBrowser = window.Capacitor?.Plugins?.NativeBrowser;
  if (!nativeBrowser?.open) return false;

  try {
    const result = await nativeBrowser.open({
      url: normalizeUrl(startUrl || getBrowserCurrentUrl() || BROWSER_URLS.youtube)
    });
    sendNativeBrowserResult(result);
  } catch {
    addSystemMessage("Native browser could not open.");
  }

  return true;
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isYoutubeUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be";
  } catch {
    return false;
  }
}

function getYoutubeId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parsed.searchParams.has("v")) return parsed.searchParams.get("v") || "";
    if (host === "youtu.be") return parts[0] || "";
    const embedIndex = parts.findIndex(part => part === "embed");
    if (embedIndex >= 0) return parts[embedIndex + 1] || "";
    const shortsIndex = parts.findIndex(part => part === "shorts");
    if (shortsIndex >= 0) return parts[shortsIndex + 1] || "";
    return "";
  } catch {
    return "";
  }
}

function isDirectVideoUrl(url) {
  try {
    const parsed = new URL(url);
    return /\.(mp4|m4v|webm|ogg|ogv|mov|m3u8)(\?.*)?$/i.test(parsed.pathname + parsed.search);
  } catch {
    return false;
  }
}

function isLikelyBlockedEmbed(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch" ||
      host === "drive.google.com"
    );
  } catch {
    return false;
  }
}

function playerUrlFromMediaUrl(url) {
  if (isYoutubeUrl(url)) {
    const id = getYoutubeId(url);
    if (id) {
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&enablejsapi=1`;
    }
  }
  return url;
}

function clearPlayerSurfaces() {
  nativeVideo.pause();
  nativeVideo.removeAttribute("src");
  nativeVideo.load();
  playerFrame.src = "about:blank";
  playerFallback.hidden = true;
}

function setPlayerMode(mode) {
  currentPlayerMode = mode;
  playerShell.classList.toggle("is-empty", mode === "empty");
  playerShell.classList.toggle("is-native", mode === "native");
  playerShell.classList.toggle("is-frame", mode === "frame");
  playerShell.classList.toggle("is-fallback", mode === "fallback");
  emptyPlayer.hidden = mode !== "empty";
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.at(-1)?.replace(/[-_]+/g, " ").slice(0, 80) || parsed.hostname;
  } catch {
    return "Video";
  }
}

function enterRoom(code) {
  roomCode = code;
  roomCodeLabel.textContent = code;
  lobbyView.hidden = true;
  roomView.hidden = false;
  setLobbyStatus("");
}

function loadPlayer(media) {
  currentMedia = media;
  const url = normalizeUrl(media?.url);
  if (!url) return;

  currentPlayerUrl = url;
  clearPlayerSurfaces();
  mediaUrlInput.value = url;
  playPauseButton.disabled = false;
  stopVideoButton.disabled = false;

  if (isDirectVideoUrl(url)) {
    setPlayerMode("native");
    nativeVideo.src = url;
    nativeVideo.load();
    nativeVideo.play().catch(() => {
      setMediaStatus("Tap play to start native video");
    });
    setMediaStatus(media?.title || "Native player");
    return;
  }

  if (isLikelyBlockedEmbed(url)) {
    setPlayerMode("fallback");
    playerFallback.hidden = false;
    setMediaStatus("Open in Android browser");
    return;
  }

  setPlayerMode("frame");
  playerFrame.src = playerUrlFromMediaUrl(url);
  setMediaStatus(media?.title || "Playing");
}

function stopPlayer() {
  currentMedia = null;
  currentPlayerUrl = "";
  clearPlayerSurfaces();
  setPlayerMode("empty");
  playPauseButton.disabled = true;
  stopVideoButton.disabled = true;
  setMediaStatus("Empty");
}

function renderQueue(items = []) {
  queueItems = Array.isArray(items) ? items : [];
  queueCount.textContent = String(queueItems.length);
  queueList.innerHTML = "";

  if (!queueItems.length) {
    const empty = document.createElement("div");
    empty.className = "system-message";
    empty.textContent = "Nothing queued";
    queueList.appendChild(empty);
    return;
  }

  queueItems.forEach(item => {
    const row = document.createElement("article");
    row.className = "queue-item";
    row.innerHTML = `
      <div>
        <strong>${item.title || titleFromUrl(item.url)}</strong>
        <small>Added by ${item.addedBy || "Guest"}</small>
      </div>
      <button class="ghost-button" type="button">Play</button>
    `;

    row.querySelector("button").onclick = () => {
      socket.emit("loadMedia", {
        room: roomCode,
        username,
        url: item.url,
        title: item.title || titleFromUrl(item.url)
      });
    };

    queueList.appendChild(row);
  });
}

function addChatMessage(data) {
  const item = document.createElement("article");
  item.className = data.username === username ? "message is-mine" : "message";
  item.innerHTML = `
    <strong>${data.username || "Guest"}</strong>
    <small>${new Date(data.sentAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
    <p>${data.message || ""}</p>
  `;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(text) {
  const item = document.createElement("div");
  item.className = "system-message";
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function getName() {
  const nextName = nameInput.value.trim() || "Guest";
  username = nextName;
  localStorage.setItem("watchPartyMobileName", nextName);
  return nextName;
}

function randomRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

createRoomButton.onclick = () => {
  if (!socket.connected) {
    setLobbyStatus("Connecting to server. Try again in a moment.");
    return;
  }

  const code = randomRoomCode();
  pendingRoomCode = code;
  setLobbyStatus("Creating room...");
  createRoomButton.disabled = true;
  joinRoomButton.disabled = true;
  socket.emit("createRoom", {
    room: code,
    username: getName()
  });
};

joinRoomButton.onclick = () => {
  if (!socket.connected) {
    setLobbyStatus("Connecting to server. Try again in a moment.");
    return;
  }

  const code = roomInput.value.trim();
  if (!code) {
    setLobbyStatus("Enter a room code.");
    return;
  }
  setLobbyStatus("Joining room...");
  pendingRoomCode = code;
  createRoomButton.disabled = true;
  joinRoomButton.disabled = true;
  socket.emit("joinRoom", {
    room: code,
    username: getName()
  });
};

playerTab.onclick = () => setRoomTab("player");
browserTab.onclick = async () => {
  if (await openNativeBrowser(getBrowserCurrentUrl() || BROWSER_URLS.youtube)) return;
  setRoomTab("browser");
};

browserSiteButtons.forEach(button => {
  button.onclick = async () => {
    const siteUrl = BROWSER_URLS[button.dataset.site] || BROWSER_URLS.youtube;
    if (await openNativeBrowser(siteUrl)) return;
    loadBrowserSite(button.dataset.site);
  };
});

browserForm.onsubmit = event => {
  event.preventDefault();
  navigateBrowser(browserSearchUrl(browserUrlInput.value));
};

browserBackButton.onclick = () => {
  if (browserHistoryIndex <= 0) return;
  browserHistoryIndex -= 1;
  browserFrame.src = browserHistory[browserHistoryIndex];
  updateBrowserControls();
};

browserForwardButton.onclick = () => {
  if (browserHistoryIndex >= browserHistory.length - 1) return;
  browserHistoryIndex += 1;
  browserFrame.src = browserHistory[browserHistoryIndex];
  updateBrowserControls();
};

browserReloadButton.onclick = () => {
  const url = getBrowserCurrentUrl();
  if (url) {
    browserFrame.src = url;
  }
};

copyRoomButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    addSystemMessage(`Room code copied: ${roomCode}`);
  } catch {
    addSystemMessage(`Room code: ${roomCode}`);
  }
};

leaveRoomButton.onclick = () => {
  socket.emit("leaveRoom");
  location.reload();
};

loadMediaButton.onclick = () => {
  const url = normalizeUrl(mediaUrlInput.value);
  if (!url) {
    setMediaStatus("Paste a link");
    return;
  }
  socket.emit("loadMedia", {
    room: roomCode,
    username,
    url,
    title: titleFromUrl(url)
  });
};

addQueueButton.onclick = () => {
  const url = normalizeUrl(mediaUrlInput.value);
  if (!url) {
    setMediaStatus("Paste a link");
    return;
  }
  socket.emit("addQueue", {
    room: roomCode,
    username,
    url,
    title: titleFromUrl(url)
  });
  setMediaStatus("Queued");
};

stopVideoButton.onclick = () => {
  socket.emit("stopMedia", {
    room: roomCode,
    username
  });
};

playPauseButton.onclick = () => {
  if (currentPlayerMode === "native") {
    if (nativeVideo.paused) {
      nativeVideo.play().catch(() => setMediaStatus("Tap the video to play"));
    } else {
      nativeVideo.pause();
    }
    return;
  }

  if (currentPlayerMode === "frame") {
    playerFrame.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: "playVideo",
        args: []
      }),
      "*"
    );
    addSystemMessage("Mobile embedded playback depends on the video site.");
    return;
  }

  if (currentPlayerUrl) {
    window.open(currentPlayerUrl, "_blank", "noopener,noreferrer");
  }
};

openExternalVideo.onclick = () => {
  if (currentPlayerUrl) {
    window.open(currentPlayerUrl, "_blank", "noopener,noreferrer");
  }
};

nativeVideo.addEventListener("play", () => {
  playPauseButton.textContent = "Pause";
});

nativeVideo.addEventListener("pause", () => {
  playPauseButton.textContent = "Play";
});

nativeVideo.addEventListener("error", () => {
  setPlayerMode("fallback");
  playerFallback.hidden = false;
  setMediaStatus("Native player could not open this link");
});

sendForm.onsubmit = event => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;
  socket.emit("chat", { room: roomCode, username, message });
  messageInput.value = "";
};

messageInput.addEventListener("input", () => {
  if (!roomCode) return;
  socket.emit("typing", { room: roomCode, username });
});

socket.on("connect", () => {
  setLobbyStatus("");
  createRoomButton.disabled = false;
  joinRoomButton.disabled = false;
});

socket.on("connect_error", () => {
  setLobbyStatus("Cannot connect to server yet. Check Wi-Fi or Render server.");
  createRoomButton.disabled = false;
  joinRoomButton.disabled = false;
});

socket.on("roomCreated", data => {
  const code = String(data?.room || "").trim();
  if (!code) {
    setLobbyStatus("Could not create room.");
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
    return;
  }

  socket.emit("joinRoom", {
    room: code,
    username: getName(),
    create: true
  });
});

socket.on("roomError", text => {
  setLobbyStatus(text || "Could not join room.");
  addSystemMessage(text || "Room error.");
  pendingRoomCode = "";
  createRoomButton.disabled = false;
  joinRoomButton.disabled = false;
});

socket.on("roomUsers", data => {
  if (data?.users?.length && roomCode) {
    guestCount.textContent = `${data.users.length} people`;
  }
  if (!roomView.hidden) return;

  const joinedRoom = String(data?.room || pendingRoomCode || roomInput.value.trim() || "").trim();
  if (joinedRoom) {
    enterRoom(joinedRoom);
    pendingRoomCode = "";
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
  }
});

socket.on("mediaLoaded", loadPlayer);
socket.on("mediaStopped", stopPlayer);
socket.on("queueUpdated", renderQueue);
socket.on("chat", addChatMessage);
socket.on("system", addSystemMessage);
socket.on("typing", data => {
  if (!data?.username || data.username === username) return;
  typing.textContent = `${data.username} is typing...`;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typing.textContent = "";
  }, 1200);
});

if (window.Capacitor?.Plugins?.StatusBar) {
  window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: "#0b0d12" }).catch(() => {});
}
