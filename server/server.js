const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

function loadLocalEnv() {
    const envPath = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex <= 0) return;

        const key = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
}

loadLocalEnv();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const CLIENT_SRC_DIR = path.join(__dirname, "..", "client", "src");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_DRIVE_REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "";
const GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const rooms = {};
let driveTokens = GOOGLE_DRIVE_REFRESH_TOKEN
    ? {
        refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN,
        access_token: "",
        expires_at: 0
    }
    : null;

app.get("/", (req, res) => {
    res.json({
        ok: true,
        name: "Eneclez Watch Party",
        service: "watch-party-server"
    });
});

app.get("/youtube-player.html", (req, res) => {
    res.sendFile(path.join(CLIENT_SRC_DIR, "youtube-player.html"));
});

function getPublicOrigin(req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return process.env.APP_PUBLIC_URL || `${proto}://${host}`;
}

function getDriveRedirectUri(req) {
    return process.env.GOOGLE_REDIRECT_URI || `${getPublicOrigin(req)}/api/drive/oauth/callback`;
}

function getGoogleDriveFileId(url) {
    try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.pathname.split("/").filter(Boolean);
        const fileIndex = parts.findIndex(part => part.toLowerCase() === "d");

        if (!isGoogleDriveUrl(url)) return "";

        if (parsedUrl.searchParams.has("id")) {
            return parsedUrl.searchParams.get("id") || "";
        }

        if (parts[0]?.toLowerCase() === "file" && fileIndex >= 0) {
            return parts[fileIndex + 1] || "";
        }

        if (parts[0]?.toLowerCase() === "uc") {
            return parsedUrl.searchParams.get("id") || "";
        }

        return "";
    } catch {
        return "";
    }
}

function isDriveOAuthConfigured() {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

async function exchangeDriveToken(params) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams(params)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error_description || payload.error || "Google token exchange failed");
    }

    return payload;
}

async function refreshDriveAccessToken() {
    if (!driveTokens?.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return "";
    }

    const payload = await exchangeDriveToken({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: driveTokens.refresh_token,
        grant_type: "refresh_token"
    });

    driveTokens = {
        ...driveTokens,
        access_token: payload.access_token,
        expires_at: Date.now() + Math.max(0, (Number(payload.expires_in) || 3600) - 60) * 1000
    };

    return driveTokens.access_token;
}

async function getDriveAccessToken() {
    if (!driveTokens) return "";
    if (driveTokens.access_token && driveTokens.expires_at > Date.now()) {
        return driveTokens.access_token;
    }

    return refreshDriveAccessToken();
}

async function driveApiFetch(url, options = {}, retry = true) {
    const accessToken = await getDriveAccessToken();
    if (!accessToken) {
        const error = new Error("Google Drive is not signed in");
        error.status = 401;
        throw error;
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            authorization: `Bearer ${accessToken}`
        }
    });

    if (response.status === 401 && retry) {
        await refreshDriveAccessToken();
        return driveApiFetch(url, options, false);
    }

    return response;
}

app.get("/api/drive/status", (_req, res) => {
    res.json({
        configured: isDriveOAuthConfigured(),
        signedIn: Boolean(driveTokens?.refresh_token)
    });
});

app.get("/api/drive/auth/start", (req, res) => {
    if (!isDriveOAuthConfigured()) {
        res.status(500).send("Google Drive OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
        return;
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", getDriveRedirectUri(req));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_DRIVE_SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");

    res.redirect(authUrl.toString());
});

app.get("/api/drive/oauth/callback", async (req, res) => {
    const code = String(req.query.code || "");

    if (!code) {
        res.status(400).send("Missing Google OAuth code.");
        return;
    }

    try {
        const payload = await exchangeDriveToken({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: getDriveRedirectUri(req),
            grant_type: "authorization_code"
        });

        driveTokens = {
            refresh_token: payload.refresh_token || driveTokens?.refresh_token || "",
            access_token: payload.access_token,
            expires_at: Date.now() + Math.max(0, (Number(payload.expires_in) || 3600) - 60) * 1000
        };

        res.send(`
            <!doctype html>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; color: #f6f7fb; background: #0b0d12; }
                main { max-width: 420px; padding: 28px; text-align: center; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: #151922; }
                strong { display: block; margin-bottom: 8px; font-size: 22px; }
                p { color: #a5adbd; }
            </style>
            <main>
                <strong>Google Drive connected</strong>
                <p>You can close this page and play Drive videos in Eneclez Watch Party.</p>
            </main>
        `);
    } catch (error) {
        res.status(500).send(`Google Drive sign in failed: ${error.message}`);
    }
});

app.get("/api/drive/stream/:fileId", async (req, res) => {
    const fileId = cleanText(req.params.fileId, "", 160);
    if (!fileId) {
        res.status(400).send("Missing Drive file ID.");
        return;
    }

    try {
        const driveUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
        driveUrl.searchParams.set("alt", "media");
        driveUrl.searchParams.set("supportsAllDrives", "true");

        const headers = {};
        if (req.headers.range) {
            headers.range = req.headers.range;
        }

        const driveResponse = await driveApiFetch(driveUrl.toString(), { headers });

        if (!driveResponse.ok && driveResponse.status !== 206) {
            const errorText = await driveResponse.text().catch(() => "Google Drive stream failed");
            res.status(driveResponse.status).send(errorText);
            return;
        }

        const passthroughHeaders = [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "etag",
            "last-modified"
        ];

        passthroughHeaders.forEach(header => {
            const value = driveResponse.headers.get(header);
            if (value) res.setHeader(header, value);
        });

        res.setHeader("cache-control", "no-store");
        res.status(driveResponse.status);

        if (!driveResponse.body) {
            res.end();
            return;
        }

        const reader = driveResponse.body.getReader();
        const pump = () => reader.read()
            .then(({ done, value }) => {
                if (done) {
                    res.end();
                    return;
                }

                res.write(Buffer.from(value), pump);
            })
            .catch(() => {
                if (!res.headersSent) res.status(500);
                res.end();
            });

        pump();
    } catch (error) {
        res.status(error.status || 500).send(error.message || "Google Drive stream failed.");
    }
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

function isGoogleDriveUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const allowedHosts = ["drive.google.com", "docs.google.com", "googleusercontent.com", "googlevideo.com", "usercontent.google.com"];

        return allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
    } catch {
        return false;
    }
}

function isSupportedMediaUrl(url) {
    return isBilibiliUrl(url) || isYoutubeUrl(url) || isDailymotionUrl(url) || isFacebookUrl(url) || isGoogleDriveUrl(url);
}

function publicUsers(room) {
    return Array.from(rooms[room].users.values());
}

function publicControllers(room) {
    return Array.from(rooms[room].controllers || []);
}

function publicVoiceUsers(room) {
    return Array.from(rooms[room].voiceUsers?.values() || []);
}

function emitRoomUsers(room) {
    if (!rooms[room]) return;

    io.to(room).emit("roomUsers", {
        host: rooms[room].host,
        users: publicUsers(room),
        controllers: publicControllers(room)
    });
}

function emitVoiceUsers(room) {
    if (!rooms[room]) return;

    io.to(room).emit("voiceUsers", publicVoiceUsers(room));
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
        voiceUsers: new Map(),
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
    rooms[room].voiceUsers?.delete(socket.id);
    socket.to(room).emit("voicePeerLeft", {
        id: socket.id,
        username
    });
    emitVoiceUsers(room);
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
        socket.emit("voiceUsers", publicVoiceUsers(room));

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

    socket.on("voiceJoin", (data, reply) => {
        const room = cleanText(data.room || socket.data.room);
        const username = cleanText(data.username || socket.data.username, "Guest");
        const respond = payload => {
            if (typeof reply === "function") reply(payload);
        };

        if (!rooms[room] || socket.data.room !== room) {
            respond({ ok: false, message: "Join the room before joining mic." });
            return;
        }

        rooms[room].voiceUsers.set(socket.id, {
            id: socket.id,
            username,
            muted: false
        });

        const peers = Array.from(rooms[room].voiceUsers.values())
            .filter(peer => peer.id !== socket.id);

        respond({ ok: true, id: socket.id, peers });
        socket.to(room).emit("voicePeerJoined", {
            id: socket.id,
            username,
            muted: false
        });
        emitVoiceUsers(room);
    });

    socket.on("voiceSignal", data => {
        const room = cleanText(data.room || socket.data.room);
        const target = cleanText(data.target, "", 120);
        const signal = data.signal;

        if (!rooms[room] || socket.data.room !== room || !target || !signal) return;

        socket.to(target).emit("voiceSignal", {
            from: socket.id,
            username: socket.data.username,
            signal
        });
    });

    socket.on("voiceMute", data => {
        const room = cleanText(data.room || socket.data.room);
        const muted = Boolean(data.muted);
        const peer = rooms[room]?.voiceUsers?.get(socket.id);

        if (!peer) return;

        peer.muted = muted;
        socket.to(room).emit("voicePeerMuted", {
            id: socket.id,
            username: peer.username,
            muted
        });
        emitVoiceUsers(room);
    });

    socket.on("voiceLeave", data => {
        const room = cleanText(data.room || socket.data.room);
        const peer = rooms[room]?.voiceUsers?.get(socket.id);

        if (!peer) return;

        rooms[room].voiceUsers.delete(socket.id);
        socket.to(room).emit("voicePeerLeft", {
            id: socket.id,
            username: peer.username
        });
        emitVoiceUsers(room);
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
            paused: false,
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
