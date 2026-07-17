const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("roomCode");
const statusText = document.getElementById("status");
const recentRoomsSection = document.getElementById("recentRoomsSection");
const recentRoomsEl = document.getElementById("recentRooms");
const clearRecentRoomsButton = document.getElementById("clearRecentRooms");
const RECENT_ROOMS_KEY = "eneclezRecentRooms";

function randomName() {
    const names = ["BlueFox", "ShadowTiger", "MoonCat", "SilverBear", "NeonNova", "CozyPilot"];
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 999);
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
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms.slice(0, 8)));
}

function openRoom(room, options = {}) {
    saveRecentRoom(room, options);
    location.href = `/mobile/room?room=${room}${options.created ? "&create=1" : ""}`;
}

function renderRecentRooms() {
    const rooms = readRecentRooms();
    recentRoomsSection.hidden = rooms.length === 0;
    recentRoomsEl.innerHTML = "";

    rooms.forEach(item => {
        const row = document.createElement("article");
        row.className = "mobile-recent";
        row.innerHTML = `
            <div>
                <strong>${item.room}</strong>
                <span>${item.created ? "Created" : "Joined"} ${new Date(item.joinedAt).toLocaleDateString()}</span>
            </div>
            <button class="secondary-action" type="button">Join</button>
        `;
        row.querySelector("button").addEventListener("click", () => {
            saveUsername();
            openRoom(item.room);
        });
        recentRoomsEl.appendChild(row);
    });
}

let username = localStorage.getItem("username") || randomName();
localStorage.setItem("username", username);
usernameInput.value = username;
renderRecentRooms();

document.getElementById("createRoom").addEventListener("click", () => {
    saveUsername();
    openRoom(String(Math.floor(100000 + Math.random() * 900000)), { created: true });
});

document.getElementById("joinRoom").addEventListener("click", () => {
    saveUsername();
    const room = roomInput.value.trim();

    if (!/^\d{6}$/.test(room)) {
        statusText.textContent = "Enter a 6 digit room code.";
        roomInput.focus();
        return;
    }

    openRoom(room);
});

roomInput.addEventListener("input", () => {
    roomInput.value = roomInput.value.replace(/\D/g, "").slice(0, 6);
    statusText.textContent = "";
});

roomInput.addEventListener("keydown", event => {
    if (event.key === "Enter") document.getElementById("joinRoom").click();
});

clearRecentRoomsButton.addEventListener("click", () => {
    localStorage.removeItem(RECENT_ROOMS_KEY);
    renderRecentRooms();
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/mobile/sw.js").catch(() => {});
    });
}
