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
const playerShell = document.getElementById("playerShell");
const playerFrame = document.getElementById("playerFrame");
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

let username = localStorage.getItem("watchPartyMobileName") || "";
let roomCode = "";
let queueItems = [];
let currentMedia = null;
let typingTimer = null;

nameInput.value = username;

function setLobbyStatus(text) {
  lobbyStatus.textContent = text || "";
}

function setMediaStatus(text) {
  mediaStatus.textContent = text || "";
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

function playerUrlFromMediaUrl(url) {
  if (isYoutubeUrl(url)) {
    const id = getYoutubeId(url);
    if (id) {
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0`;
    }
  }
  return url;
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
}

function loadPlayer(media) {
  currentMedia = media;
  const url = normalizeUrl(media?.url);
  if (!url) return;

  playerShell.classList.remove("is-empty");
  emptyPlayer.hidden = true;
  playerFrame.src = playerUrlFromMediaUrl(url);
  mediaUrlInput.value = url;
  playPauseButton.disabled = false;
  stopVideoButton.disabled = false;
  setMediaStatus(media?.title || "Playing");
}

function stopPlayer() {
  currentMedia = null;
  playerFrame.src = "about:blank";
  playerShell.classList.add("is-empty");
  emptyPlayer.hidden = false;
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
  const code = randomRoomCode();
  setLobbyStatus("Creating room...");
  socket.emit("createRoom", {
    room: code,
    username: getName()
  });
  enterRoom(code);
};

joinRoomButton.onclick = () => {
  const code = roomInput.value.trim();
  if (!code) {
    setLobbyStatus("Enter a room code.");
    return;
  }
  setLobbyStatus("Joining room...");
  socket.emit("joinRoom", {
    room: code,
    username: getName()
  });
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
  addSystemMessage("Mobile pause/play sync is limited in this APK MVP.");
};

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
});

socket.on("roomError", text => {
  setLobbyStatus(text || "Could not join room.");
  addSystemMessage(text || "Room error.");
});

socket.on("roomUsers", data => {
  if (data?.users?.length && roomCode) {
    guestCount.textContent = `${data.users.length} people`;
  }
  if (!roomView.hidden) return;
  if (roomInput.value.trim()) enterRoom(roomInput.value.trim());
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
