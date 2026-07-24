const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("roomCode");
const statusText = document.getElementById("status");
const recentRoomsSection = document.getElementById("recentRoomsSection");
const recentRoomsEl = document.getElementById("recentRooms");
const clearRecentRoomsButton = document.getElementById("clearRecentRooms");
const appLoadingOverlay = document.getElementById("appLoadingOverlay");
const appLoadingTitle = document.getElementById("appLoadingTitle");
const appLoadingText = document.getElementById("appLoadingText");
const settingsOpenButton = document.getElementById("settingsOpen");
const settingsCloseButton = document.getElementById("settingsClose");
const settingsModal = document.getElementById("settingsModal");
const settingsVersion = document.getElementById("settingsVersion");
const settingsName = document.getElementById("settingsName");
const settingsVolume = document.getElementById("settingsVolume");
const settingsUpdateStatus = document.getElementById("settingsUpdateStatus");
const settingsUpdateCheckButton = document.getElementById("settingsUpdateCheck");
const settingsCacheStatus = document.getElementById("settingsCacheStatus");
const settingsClearCacheButton = document.getElementById("settingsClearCache");
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
    updateSettingsSnapshot();
    return username;
}

function updateSettingsSnapshot() {
    if (settingsName) {
        settingsName.textContent = usernameInput.value.trim() || localStorage.getItem("username") || "Not set yet.";
    }

    if (settingsVolume) {
        const volume = Number(localStorage.getItem("watchPartyVolume") || 100);
        settingsVolume.textContent = `${Math.max(0, Math.min(100, Math.round(volume)))}%`;
    }
}

function setUpdateStatus(message, options = {}) {
    if (settingsUpdateStatus) settingsUpdateStatus.textContent = message;
    if (settingsUpdateCheckButton) settingsUpdateCheckButton.disabled = Boolean(options.busy);
}

function setCacheStatus(message, options = {}) {
    if (settingsCacheStatus) settingsCacheStatus.textContent = message;
    if (settingsClearCacheButton) settingsClearCacheButton.disabled = Boolean(options.busy);
}

async function loadAppInfo() {
    if (!window.watchParty?.getAppInfo) {
        if (settingsVersion) settingsVersion.textContent = "Desktop app";
        return;
    }

    try {
        const info = await window.watchParty.getAppInfo();
        if (settingsVersion) {
            settingsVersion.textContent = `Eneclez Watch Party ${info.version}${info.isPackaged ? "" : " (dev)"}`;
        }
    } catch {
        if (settingsVersion) settingsVersion.textContent = "Version unavailable";
    }
}

function openSettings() {
    updateSettingsSnapshot();
    loadAppInfo();
    if (settingsModal) settingsModal.hidden = false;
}

function closeSettings() {
    if (settingsModal) settingsModal.hidden = true;
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
            location.href = `room.html?room=${item.room}`;
        });

        roomItem.append(copy, joinButton);
        recentRoomsEl.appendChild(roomItem);
    });
}

let username = localStorage.getItem("username");

if (!username) {
    username = randomName();
    localStorage.setItem("username", username);
}

usernameInput.value = username;
renderRecentRooms();
updateSettingsSnapshot();
loadAppInfo();

document.getElementById("create").onclick = () => {
    saveUsername();

    const room = String(Math.floor(100000 + Math.random() * 900000));
    saveRecentRoom(room, { created: true });
    setLobbyLoading(true, "Creating room", `Opening room ${room}`);
    location.href = `room.html?room=${room}&create=1`;
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
    location.href = `room.html?room=${room}`;
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

settingsOpenButton?.addEventListener("click", openSettings);
settingsCloseButton?.addEventListener("click", closeSettings);

settingsModal?.addEventListener("click", event => {
    if (event.target === settingsModal) closeSettings();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && settingsModal && !settingsModal.hidden) {
        closeSettings();
    }
});

settingsUpdateCheckButton?.addEventListener("click", async () => {
    if (!window.watchParty?.checkForUpdates) {
        setUpdateStatus("Update checks are available in the desktop app.");
        return;
    }

    setUpdateStatus("Checking for updates...", { busy: true });
    const result = await window.watchParty.checkForUpdates();

    if (result?.message) {
        setUpdateStatus(result.message, { busy: result.state === "checking" });
    } else {
        setUpdateStatus("Checking for updates...", { busy: true });
    }
});

settingsClearCacheButton?.addEventListener("click", async () => {
    if (!window.watchParty?.clearCache) {
        setCacheStatus("Clear cache is available in the desktop app.");
        return;
    }

    setCacheStatus("Clearing browser cache...", { busy: true });

    try {
        const result = await window.watchParty.clearCache();
        setCacheStatus(result?.message || "Browser cache cleared.");
    } catch {
        setCacheStatus("Could not clear cache. Close room windows and try again.");
    }
});

window.watchParty?.onUpdateStatus?.(status => {
    if (!status?.message) return;
    setUpdateStatus(status.message, {
        busy: status.state === "checking" || status.state === "downloading"
    });
});
