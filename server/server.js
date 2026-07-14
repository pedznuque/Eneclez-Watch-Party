const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const CLIENT_SRC_DIR = path.join(__dirname, "..", "client", "src");

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const rooms = {};

app.get("/youtube-player.html", (req, res) => {
    res.sendFile(path.join(CLIENT_SRC_DIR, "youtube-player.html"));
});

function cleanText(value, fallback = "", limit = 80) {
    return String(value || fallback).trim().slice(0, limit);
}

function cleanUrl(value) {
    return cleanText(value, "", 2048);
}

function clampNumber(value, min = 0, max = 1, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function isBilibiliUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const allowedHosts = ["bilibili.com", "bilibili.tv", "b23.tv"];

        return allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
    } catch {
        return false;
    }
}

function isYoutubeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const allowedHosts = ["youtube.com", "youtu.be", "youtube-nocookie.com"];

        return allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
    } catch {
        return false;
    }
}

function isDailymotionUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const allowedHosts = ["dailymotion.com", "dai.ly"];

        return allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
    } catch {
        return false;
    }
}

function isFacebookUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const allowedHosts = ["facebook.com", "fb.watch"];

        return allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
    } catch {
        return false;
    }
}

function isSupportedMediaUrl(url) {
    return isBilibiliUrl(url) || isYoutubeUrl(url) || isDailymotionUrl(url) || isFacebookUrl(url);
}

function publicUsers(room) {
    return Array.from(rooms[room].users.values());
}

function publicControllers(room) {
    return Array.from(rooms[room].controllers || []);
}

function emitRoomUsers(room) {
    if (!rooms[room]) return;

    io.to(room).emit("roomUsers", {
        host: rooms[room].host,
        users: publicUsers(room),
        controllers: publicControllers(room)
    });
}

function canControlRoom(room, socket) {
    const username = socket.data.username;
    const roomState = rooms[room];

    return Boolean(
        roomState &&
        username &&
        (username === roomState.host || roomState.controllers?.has(username))
    );
}

function createRoomState(host) {
    return {
        host,
        users: new Map(),
        controllers: new Set(),
        queue: [],
        currentMedia: null,
        playbackState: null
    };
}

function createPlaybackState(data, username) {
    const now = Date.now();
    const currentTime = Number(data.currentTime);
    const duration = Number(data.duration);
    const paused = Boolean(data.paused);
    const safeCurrentTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;

    return {
        syncSessionId: `${now}-${Math.random().toString(16).slice(2)}`,
        currentTime: safeDuration > 0 ? Math.min(safeDuration, safeCurrentTime) : safeCurrentTime,
        duration: safeDuration,
        paused,
        quality: cleanText(data.quality, "auto", 20),
        syncedAt: now,
        playStartedAt: paused ? null : now - (safeCurrentTime * 1000),
        updatedAt: now,
        updatedBy: username
    };
}

function currentPlaybackState(room) {
    const state = rooms[room]?.playbackState;
    if (!state) return null;

    const now = Date.now();
    const duration = Number(state.duration) || 0;
    const baseTime = Number(state.currentTime) || 0;
    const liveTime = state.paused || !state.playStartedAt
        ? baseTime
        : Math.max(0, (now - Number(state.playStartedAt)) / 1000);

    return {
        ...state,
        currentTime: duration > 0 ? Math.min(duration, liveTime) : liveTime,
        syncedAt: now,
        updatedAt: now
    };
}

function leaveCurrentRoom(socket) {
    const { room, username } = socket.data;

    if (!room || !rooms[room]) return;

    rooms[room].users.delete(socket.id);
    if (username) {
        rooms[room].controllers?.delete(username);
    }
    socket.leave(room);

    if (rooms[room].users.size === 0) {
        delete rooms[room];
        socket.data.room = null;
        return;
    }

    if (username === rooms[room].host) {
        const nextHost = rooms[room].users.values().next().value;

        if (nextHost) {
            rooms[room].host = nextHost;
            rooms[room].controllers?.delete(nextHost);
            io.to(room).emit("system", `${nextHost} is now the host.`);
        }
    }

    emitRoomUsers(room);

    if (username) {
        io.to(room).emit("system", `${username} left the room`);
    }

    socket.data.room = null;
}

io.on("connection", socket => {
    socket.on("createRoom", data => {
        const room = cleanText(data.room);
        const username = cleanText(data.username, "Guest");

        if (!room) return;

        if (!rooms[room]) {
            rooms[room] = createRoomState(username);
        }

        socket.emit("roomCreated", { room });
    });

    socket.on("joinRoom", data => {
        const room = cleanText(data.room);
        const username = cleanText(data.username, "Guest");
        const shouldCreate = Boolean(data.create);

        if (!room) {
            socket.emit("roomError", "Missing room code");
            return;
        }

        if (!rooms[room]) {
            if (!shouldCreate) {
                socket.emit("roomError", "Room does not exist");
                return;
            }

            rooms[room] = createRoomState(username);
        }

        leaveCurrentRoom(socket);

        socket.join(room);
        socket.data.room = room;
        socket.data.username = username;
        rooms[room].users.set(socket.id, username);

        emitRoomUsers(room);

        socket.to(room).emit("system", `${username} joined the room`);

        socket.emit("queueUpdated", rooms[room].queue);

        if (rooms[room].currentMedia) {
            socket.emit("mediaLoaded", rooms[room].currentMedia);
        }

        if (rooms[room].playbackState) {
            socket.emit("mediaPlayback", currentPlaybackState(room));
        }
    });

    socket.on("chat", data => {
        const room = cleanText(data.room);
        const username = cleanText(data.username, "Guest");
        const message = cleanText(data.message, "", 500);

        if (!rooms[room] || !message) return;

        io.to(room).emit("chat", {
            username,
            message,
            sentAt: Date.now()
        });
    });

    socket.on("typing", data => {
        const room = cleanText(data.room);
        const username = cleanText(data.username, "Guest");

        if (rooms[room]) {
            socket.to(room).emit("typing", { username });
        }
    });

    socket.on("playerEffect", data => {
        const room = cleanText(data.room);
        const username = cleanText(data.username, "Guest");
        const effectType = cleanText(data.type, "heart", 20);
        const effectLabels = {
            heart: "heart",
            cat: "cat",
            star: "star",
            bolt: "bolt"
        };
        const label = effectLabels[effectType] || "heart";

        if (!rooms[room]) return;

        io.to(room).emit("playerEffect", {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            username,
            type: label,
            x: clampNumber(data.x, 0.03, 0.97, 0.5),
            y: clampNumber(data.y, 0.06, 0.94, 0.5),
            sentAt: Date.now()
        });
        io.to(room).emit("system", `${username} sent a ${label}`);
    });

    socket.on("setController", (data, reply) => {
        const room = cleanText(data.room || socket.data.room);
        const target = cleanText(data.target, "", 80);
        const allowed = Boolean(data.allowed);
        const respond = payload => {
            if (typeof reply === "function") reply(payload);
        };

        if (!rooms[room]) {
            respond({ ok: false, message: "Room not found." });
            return;
        }

        if (socket.data.username !== rooms[room].host) {
            respond({ ok: false, message: "Only the host can allow control." });
            return;
        }

        if (!target || target === rooms[room].host) {
            respond({ ok: false, message: "Choose a guest to control playback." });
            return;
        }

        const currentUsers = new Set(publicUsers(room));
        if (!currentUsers.has(target)) {
            respond({ ok: false, message: `${target} is no longer in the room.` });
            return;
        }

        if (!rooms[room].controllers) {
            rooms[room].controllers = new Set();
        }

        if (allowed) {
            rooms[room].controllers.add(target);
        } else {
            rooms[room].controllers.delete(target);
        }

        emitRoomUsers(room);
        io.to(room).emit("system", `${target} ${allowed ? "can now control playback" : "can no longer control playback"}.`);
        respond({ ok: true, controllers: publicControllers(room) });
    });

    socket.on("loadMedia", data => {
        const room = cleanText(data.room);
        const url = cleanUrl(data.url);
        const title = cleanText(data.title, "Video", 140);

        if (!rooms[room] || !url || !isSupportedMediaUrl(url) || !canControlRoom(room, socket)) return;

        rooms[room].currentMedia = {
            url,
            title,
            loadedBy: cleanText(data.username, "Guest"),
            loadedAt: Date.now()
        };
        rooms[room].playbackState = createPlaybackState({
            currentTime: 0,
            duration: 0,
            paused: true,
            quality: "auto"
        }, socket.data.username || cleanText(data.username, "Guest"));

        io.to(room).emit("mediaLoaded", rooms[room].currentMedia);
        io.to(room).emit("mediaPlayback", currentPlaybackState(room));
    });

    socket.on("stopMedia", data => {
        const room = cleanText(data.room);

        if (!canControlRoom(room, socket)) return;

        rooms[room].currentMedia = null;
        rooms[room].playbackState = null;

        io.to(room).emit("mediaStopped", {
            stoppedBy: socket.data.username,
            stoppedAt: Date.now()
        });
    });

    socket.on("mediaControl", data => {
        const room = cleanText(data.room);

        if (!canControlRoom(room, socket)) return;

        rooms[room].playbackState = createPlaybackState(data, socket.data.username);

        io.to(room).emit("mediaPlayback", currentPlaybackState(room));
    });

    socket.on("addQueue", data => {
        const room = cleanText(data.room);
        const url = cleanUrl(data.url);
        const title = cleanText(data.title, "Video", 140);
        const thumbnail = cleanUrl(data.thumbnail);

        if (!rooms[room] || !url || !isSupportedMediaUrl(url)) return;

        rooms[room].queue.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            url,
            title,
            thumbnail,
            addedBy: socket.data.username || cleanText(data.username, "Guest"),
            addedAt: Date.now()
        });

        io.to(room).emit("queueUpdated", rooms[room].queue);
    });

    socket.on("removeQueue", data => {
        const room = cleanText(data.room);
        const id = cleanText(data.id, "", 120);

        if (!rooms[room] || !id) return;

        const queueItem = rooms[room].queue.find(item => item.id === id);
        const username = socket.data.username;
        const ownsQueueItem = queueItem?.addedBy === username;

        if (!queueItem || (!ownsQueueItem && !canControlRoom(room, socket))) return;

        rooms[room].queue = rooms[room].queue.filter(item => item.id !== id);
        io.to(room).emit("queueUpdated", rooms[room].queue);
    });

    socket.on("leaveRoom", () => {
        leaveCurrentRoom(socket);
    });

    socket.on("disconnect", () => {
        leaveCurrentRoom(socket);
    });
});

server.listen(PORT, () => {
    console.log(`Watch Party Server running on http://localhost:${PORT}`);
});
