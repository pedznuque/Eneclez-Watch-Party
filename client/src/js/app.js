const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("roomCode");
const statusText = document.getElementById("status");
const recentRoomsSection = document.getElementById("recentRoomsSection");
const recentRoomsEl = document.getElementById("recentRooms");
const clearRecentRoomsButton = document.getElementById("clearRecentRooms");
const appLoadingOverlay = document.getElementById("appLoadingOverlay");
const appLoadingTitle = document.getElementById("appLoadingTitle");
const appLoadingText = document.getElementById("appLoadingText");
const RECENT_ROOMS_KEY = "eneclezRecentRooms";

function randomName() {
    const names = ["BlueFox", "ShadowTiger", "MoonCat", "SilverBear", "NeonNova", "CozyPilot"];
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 999);
}

function setStatus(message) {
    statusText.textContent = message;
}

function setLobbyLoading(isLoading, title = "Opening room", text = "Connecting to Eneclez Watch Party") {
    if (!appLoadingOverlay) return;

    appLoadingOverlay.hidden = !isLoading;
    if (appLoadingTitle) appLoadingTitle.textContent = title;
    if (appLoadingText) appLoadingText.textContent = text;

    document.body.classList.toggle("is-lobby-loading", Boolean(isLoading));
    document.getElementById("create").disabled = Boolean(isLoading);
    document.getElementById("join").disabled = Boolean(isLoading);
}

function saveUsername() {
    const username = usernameInput.value.trim() || randomName();
    localStorage.setItem("username", username);
    usernameInput.value = username;
    return username;
}

function readRecentRooms() {
    try {
        const rooms = JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || "[]");
        return Array.isArray(rooms) ? rooms.filter(item => /^\d{6}$/.test(String(item.room || ""))) : [];
    } catch {
        return [];
    }
}

function saveRecentRoom(room, options = {}) {
    const safeRoom = String(room || "").trim();
    if (!/^\d{6}$/.test(safeRoom)) return;

    const rooms = readRecentRooms().filter(item => item.room !== safeRoom);
    rooms.unshift({
        room: safeRoom,
        created: Boolean(options.created),
        joinedAt: Date.now()
    });

    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms.slice(0, 5)));
}

function formatRecentRoomTime(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });
}

function renderRecentRooms() {
    const rooms = readRecentRooms();

    if (!recentRoomsSection || !recentRoomsEl) return;

    recentRoomsSection.hidden = rooms.length === 0;
    recentRoomsEl.innerHTML = "";

    rooms.forEach(item => {
        const roomItem = document.createElement("article");
        roomItem.className = "recent-room";

        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = item.room;
        const meta = document.createElement("span");
        meta.textContent = `${item.created ? "Created" : "Joined"} ${formatRecentRoomTime(item.joinedAt)}`;
        copy.append(title, meta);

        const joinButton = document.createElement("button");
        joinButton.type = "button";
        joinButton.textContent = "Join";
        joinButton.addEventListener("click", () => {
            saveUsername();
            saveRecentRoom(item.room);
            setLobbyLoading(true, "Joining room", `Opening room ${item.room}`);
            location.href = getRoomHref(item.room);
        });

        roomItem.append(copy, joinButton);
        recentRoomsEl.appendChild(roomItem);
    });
}

function getRoomHref(room, options = {}) {
    const query = `room=${room}${options.created ? "&create=1" : ""}`;
    return location.pathname.startsWith("/mobile")
        ? `/mobile/room?${query}`
        : `room.html?${query}`;
}

let username = localStorage.getItem("username");

if (!username) {
    username = randomName();
    localStorage.setItem("username", username);
}

usernameInput.value = username;
renderRecentRooms();

document.getElementById("create").onclick = () => {
    saveUsername();

    const room = String(Math.floor(100000 + Math.random() * 900000));
    saveRecentRoom(room, { created: true });
    setLobbyLoading(true, "Creating room", `Opening room ${room}`);
    location.href = getRoomHref(room, { created: true });
};

document.getElementById("join").onclick = () => {
    saveUsername();

    const room = roomInput.value.trim();

    if (!/^\d{6}$/.test(room)) {
        setStatus("Enter a 6 digit room code.");
        roomInput.focus();
        return;
    }

    saveRecentRoom(room);
    setLobbyLoading(true, "Joining room", `Opening room ${room}`);
    location.href = getRoomHref(room);
};

roomInput.addEventListener("input", () => {
    roomInput.value = roomInput.value.replace(/\D/g, "").slice(0, 6);
    setStatus("");
});

roomInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        document.getElementById("join").click();
    }
});

clearRecentRoomsButton?.addEventListener("click", () => {
    localStorage.removeItem(RECENT_ROOMS_KEY);
    renderRecentRooms();
});

if (location.pathname.startsWith("/mobile") && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/mobile/sw.js").catch(() => {});
    });
}
