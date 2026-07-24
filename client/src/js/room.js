const APP_SERVER_ORIGIN = "https://eneclez-watch-party.onrender.com";
const socket = io(APP_SERVER_ORIGIN);
const params = new URLSearchParams(window.location.search);

const roomCode = params.get("room");
const shouldCreateRoom = params.get("create") === "1";
const username = localStorage.getItem("username") || "Guest";

const codeEl = document.getElementById("code");
const connectionEl = document.getElementById("connection");
const guestCountEl = document.getElementById("guestCount");
const usersEl = document.getElementById("users");
const peopleToggleButton = document.getElementById("peopleToggle");
const peoplePopoverEl = document.getElementById("peoplePopover");
const peopleCloseButton = document.getElementById("peopleClose");
const micToggleButton = document.getElementById("micToggle");
const micLeaveButton = document.getElementById("micLeave");
const micToggleTextEl = document.getElementById("micToggleText");
const micCallCountEl = document.getElementById("micCallCount");
const fullscreenMicToggleButton = document.getElementById("fullscreenMicToggle");
const fullscreenMicLeaveButton = document.getElementById("fullscreenMicLeave");
const fullscreenMicCountEl = document.getElementById("fullscreenMicCount");
const voiceAudioDockEl = document.getElementById("voiceAudioDock");
const messagesEl = document.getElementById("messages");
let messageInput = document.getElementById("message");
const typingEl = document.getElementById("typing");
const fullscreenChatEl = document.getElementById("fullscreenChat");
const fullscreenMessagesEl = document.getElementById("fullscreenMessages");
const fullscreenTypingEl = document.getElementById("fullscreenTyping");
const fullscreenSendEl = document.getElementById("fullscreenSend");
const fullscreenMessageInput = document.getElementById("fullscreenMessage");
const fullscreenChatToggleButton = document.getElementById("fullscreenChatToggle");
const compactChatToggleButton = document.getElementById("compactChatToggle");
const compactChatBadgeEl = document.getElementById("compactChatBadge");
const compactChatResizeButton = document.getElementById("compactChatResize");
const compactChatCloseButton = document.getElementById("compactChatClose");
const compactBrowserToggleButton = document.getElementById("compactBrowserToggle");
const fullscreenEffectsEl = document.getElementById("fullscreenEffects");
const fullscreenEffectToggleButton = document.getElementById("fullscreenEffectToggle");
const fullscreenEffectTrayEl = document.getElementById("fullscreenEffectTray");
const fullscreenEffectButtons = Array.from(document.querySelectorAll(".fullscreen-effect-button"));
const roomLoadingOverlay = document.getElementById("roomLoadingOverlay");
const roomLoadingTitle = document.getElementById("roomLoadingTitle");
const roomLoadingText = document.getElementById("roomLoadingText");
const mediaUrlInput = document.getElementById("mediaUrl");
const loadMediaButton = document.getElementById("loadMedia");
const addToQueueButton = document.getElementById("addToQueue");
const mediaStatusEl = document.getElementById("mediaStatus");
const playerWebview = document.getElementById("playerWebview");
const browserWebview = document.getElementById("browserWebview");
const playerStage = document.getElementById("playerStage");
const playerPane = document.getElementById("playerPane");
const browserPane = document.getElementById("browserPane");
const playerControls = document.getElementById("playerControls");
const browserBackButton = document.getElementById("browserBack");
const browserForwardButton = document.getElementById("browserForward");
const browserReloadButton = document.getElementById("browserReload");
const browseBilibiliButton = document.getElementById("browseBilibili");
const browseYoutubeButton = document.getElementById("browseYoutube");
const browseDailymotionButton = document.getElementById("browseDailymotion");
const browseFacebookButton = document.getElementById("browseFacebook");
const browseDriveButton = document.getElementById("browseDrive");
const driveLinkControls = document.getElementById("driveLinkControls");
const driveLinkInput = document.getElementById("driveLinkInput");
const openDriveLinkButton = document.getElementById("openDriveLink");
const playDriveLinkButton = document.getElementById("playDriveLink");
const queueDriveLinkButton = document.getElementById("queueDriveLink");
const openDriveLoginButton = document.getElementById("openDriveLogin");
const playerFullscreenButton = document.getElementById("playerFullscreen");
const queueListEl = document.getElementById("queueList");
const queueCountEl = document.getElementById("queueCount");
const hostBadgeEl = document.getElementById("hostBadge");
const playPauseButton = document.getElementById("playPause");
const stopPlayerButton = document.getElementById("stopPlayer");
const playerEmptyStateEl = document.getElementById("playerEmptyState");
const playerLoadingStateEl = document.getElementById("playerLoadingState");
const playerErrorStateEl = document.getElementById("playerErrorState");
const playerErrorTextEl = document.getElementById("playerErrorText");
const retryPlayerButton = document.getElementById("retryPlayer");
const openPlayerExternalButton = document.getElementById("openPlayerExternal");
const driveContinueStateEl = document.getElementById("driveContinueState");
const continueDrivePlayerButton = document.getElementById("continueDrivePlayer");
const browserLoadingStateEl = document.getElementById("browserLoadingState");
const cleanPlayerButton = document.getElementById("cleanPlayer");
const playbackTimeEl = document.getElementById("playbackTime");
const playbackProgressEl = document.getElementById("playbackProgress");
const playPauseIconEl = document.getElementById("playPauseIcon");
const qualitySelectEl = document.getElementById("qualitySelect");
const volumeControlEl = document.getElementById("volumeControl");

let typingTimer;
let queueItems = [];
let currentHost = "";
let controllerUsers = new Set();
let lastPlaybackState = null;
let applyingRemotePlayback = false;
let selectedVideoUrl = "";
let driveFallbackAttemptedFor = "";
let driveConfirmAttemptedFor = "";
let capturedDriveMediaUrl = "";
let capturedDriveMediaAt = 0;
let driveBrowserPromotedToPlayer = false;
let handlingBrowserVideoUrl = "";
let browserVideoPromptOpen = false;
let lastPromptVideoIdentity = "";
let lastPromptAt = 0;
const recentlyHandledBrowserVideos = new Map();
let resetBrowserTimer;
let handlingPlaybackEnd = false;
let playerEndGuardTimer = null;
let queueCountdownLastSecond = null;
let seekCommitInProgress = false;
let compactChatUnreadCount = 0;
let compactBrowserTouched = false;
let compactChatResizeState = null;
let seekWasPlaying = false;
let isSeekingPlayback = false;
let selectedQuality = "auto";
let lastAppliedQuality = "";
let playerReadyCheckTimer = null;
let playerLoadingReleaseTimer = null;
let playerAutoplayTimers = [];
let playerLoadingStartedAt = 0;
let lastPlayerReadyUrl = "";
let playerResizeFrame = null;
let browserResizeFrame = null;
let isFullscreenChatVisible = true;
let lastFullscreenEffectAt = 0;
let armedFullscreenEffect = "";
let isFullscreenEffectTrayVisible = false;
let lastPlaybackDisplayText = "";
let lastPlaybackProgressValue = "";
let lastPlaybackProgressFill = "";
let lastPlaybackPausedState = null;
let fullscreenControlsIdleTimer = null;
let selectedVolume = Number(localStorage.getItem("watchPartyVolume") || 100);
let roomHasJoined = false;
let localMicStream = null;
let isMicJoined = false;
let isMicMuted = false;
let ownVoiceId = "";
let activeVoiceUsers = new Map();
const voicePeers = new Map();
let voiceAudioContext = null;
let voiceLevelFrame = null;
const voiceLevelMonitors = new Map();
const speakingVoiceIds = new Set();
let lastLoadedMediaToken = "";
const FULLSCREEN_EFFECT_TYPES = ["heart", "cat", "star", "bolt"];
const VOICE_RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

const BILIBILI_HOME = "https://www.bilibili.tv/en";
const YOUTUBE_HOME = "https://www.youtube.com/";
const DAILYMOTION_HOME = "https://www.dailymotion.com/";
const FACEBOOK_HOME = "https://www.facebook.com/watch/";
const DRIVE_HOME = "https://drive.google.com/";
let activeBrowserHome = BILIBILI_HOME;

window.watchParty?.onDriveMediaUrl?.(payload => {
    const url = payload?.url || "";
    if (!isGoogleDriveDirectMediaUrl(url)) return;

    capturedDriveMediaUrl = url;
    capturedDriveMediaAt = Number(payload?.capturedAt) || Date.now();

    if (activeBrowserHome === DRIVE_HOME) {
        setMediaStatus("Drive stream captured", "is-online");
    }
});

function setPeoplePopoverVisible(isVisible) {
    if (!peoplePopoverEl || !peopleToggleButton) return;

    peoplePopoverEl.hidden = !isVisible;
    peopleToggleButton.setAttribute("aria-expanded", String(isVisible));
}

peopleToggleButton?.addEventListener("click", event => {
    event.stopPropagation();
    setPeoplePopoverVisible(peoplePopoverEl.hidden);
});

peopleCloseButton?.addEventListener("click", () => {
    setPeoplePopoverVisible(false);
});

document.addEventListener("click", event => {
    if (peoplePopoverEl?.hidden) return;
    if (peoplePopoverEl?.contains(event.target) || peopleToggleButton?.contains(event.target)) return;

    setPeoplePopoverVisible(false);
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        setPeoplePopoverVisible(false);
    }
});

function updateMicButton() {
    if (!micToggleButton || !micToggleTextEl) return;
    const callCount = activeVoiceUsers.size;
    const callCountText = callCount === 1 ? "1 in call" : `${callCount} in call`;
    const hasSpeakingUser = speakingVoiceIds.size > 0;

    micToggleButton.classList.toggle("is-live", isMicJoined && !isMicMuted);
    micToggleButton.classList.toggle("is-muted", isMicJoined && isMicMuted);
    micToggleButton.classList.toggle("has-callers", callCount > 0);
    micToggleButton.classList.toggle("is-speaking", hasSpeakingUser);
    micToggleButton.setAttribute("aria-pressed", String(isMicJoined && !isMicMuted));
    micToggleButton.title = isMicJoined
        ? "Mute or unmute mic"
        : callCount > 0
            ? `${callCount} ${callCount === 1 ? "person is" : "people are"} in the call`
            : "Join voice chat";
    if (micLeaveButton) {
        micLeaveButton.hidden = !isMicJoined;
    }
    if (micCallCountEl) {
        micCallCountEl.textContent = callCountText;
        micCallCountEl.hidden = !isMicJoined && callCount === 0;
        micCallCountEl.classList.toggle("is-speaking", hasSpeakingUser);
    }
    if (fullscreenMicToggleButton) {
        fullscreenMicToggleButton.classList.toggle("is-live", isMicJoined && !isMicMuted);
        fullscreenMicToggleButton.classList.toggle("is-muted", isMicJoined && isMicMuted);
        fullscreenMicToggleButton.classList.toggle("has-callers", callCount > 0);
        fullscreenMicToggleButton.classList.toggle("is-speaking", hasSpeakingUser);
        fullscreenMicToggleButton.setAttribute("aria-pressed", String(isMicJoined && !isMicMuted));
        fullscreenMicToggleButton.title = isMicJoined
            ? (isMicMuted ? "Unmute mic" : "Mute mic")
            : callCount > 0
                ? `Join mic: ${callCountText}`
                : "Join mic";
        fullscreenMicToggleButton.setAttribute("aria-label", fullscreenMicToggleButton.title);
    }
    if (fullscreenMicLeaveButton) {
        fullscreenMicLeaveButton.hidden = !isMicJoined;
    }
    if (fullscreenMicCountEl) {
        fullscreenMicCountEl.textContent = String(callCount);
        fullscreenMicCountEl.hidden = callCount === 0;
        fullscreenMicCountEl.classList.toggle("is-speaking", hasSpeakingUser);
    }

    if (!isMicJoined) {
        micToggleTextEl.textContent = "Join Mic";
    } else {
        micToggleTextEl.textContent = isMicMuted ? "Unmute" : "Mute";
    }
}

function updateVoiceUsers(users) {
    activeVoiceUsers = new Map(
        (Array.isArray(users) ? users : [])
            .filter(user => user?.id)
            .map(user => [user.id, user])
    );
    Array.from(speakingVoiceIds).forEach(id => {
        if (!activeVoiceUsers.has(id)) {
            speakingVoiceIds.delete(id);
        }
    });
    updateMicButton();
}

function getVoiceAudioContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!voiceAudioContext) {
        voiceAudioContext = new AudioContextCtor();
    }
    voiceAudioContext.resume?.().catch(() => {});
    return voiceAudioContext;
}

function refreshSpeakingIndicator() {
    if (isMicMuted && ownVoiceId) {
        speakingVoiceIds.delete(ownVoiceId);
    }
    updateMicButton();
}

function stopVoiceLevelMonitor(peerId) {
    const monitor = voiceLevelMonitors.get(peerId);
    if (monitor?.source) {
        monitor.source.disconnect();
    }
    voiceLevelMonitors.delete(peerId);
    speakingVoiceIds.delete(peerId);
    refreshSpeakingIndicator();

    if (voiceLevelMonitors.size === 0 && voiceLevelFrame) {
        cancelAnimationFrame(voiceLevelFrame);
        voiceLevelFrame = null;
    }
}

function scheduleVoiceLevelMonitor() {
    if (voiceLevelFrame || voiceLevelMonitors.size === 0) return;

    const tick = () => {
        voiceLevelFrame = null;
        const now = performance.now();
        let changed = false;

        voiceLevelMonitors.forEach((monitor, peerId) => {
            monitor.analyser.getByteTimeDomainData(monitor.data);
            let sum = 0;
            for (let i = 0; i < monitor.data.length; i += 1) {
                const level = (monitor.data[i] - 128) / 128;
                sum += level * level;
            }

            const rms = Math.sqrt(sum / monitor.data.length);
            if (rms > 0.045) {
                monitor.lastSpokeAt = now;
            }

            const isSpeaking = rms > 0.045 || (monitor.speaking && now - monitor.lastSpokeAt < 320);
            if (monitor.speaking !== isSpeaking) {
                monitor.speaking = isSpeaking;
                changed = true;
                if (isSpeaking && !(peerId === ownVoiceId && isMicMuted)) {
                    speakingVoiceIds.add(peerId);
                } else {
                    speakingVoiceIds.delete(peerId);
                }
            }
        });

        if (changed) {
            refreshSpeakingIndicator();
        }

        if (voiceLevelMonitors.size > 0) {
            voiceLevelFrame = requestAnimationFrame(tick);
        }
    };

    voiceLevelFrame = requestAnimationFrame(tick);
}

function startVoiceLevelMonitor(peerId, stream) {
    if (!peerId || !stream) return;
    stopVoiceLevelMonitor(peerId);

    const context = getVoiceAudioContext();
    if (!context) return;

    try {
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.78;

        const source = context.createMediaStreamSource(stream);
        source.connect(analyser);

        voiceLevelMonitors.set(peerId, {
            analyser,
            source,
            data: new Uint8Array(analyser.fftSize),
            speaking: false,
            lastSpokeAt: 0
        });
        scheduleVoiceLevelMonitor();
    } catch {
        voiceLevelMonitors.delete(peerId);
    }
}

function createRemoteAudio(peerId, stream) {
    if (!voiceAudioDockEl) return;

    let audio = document.getElementById(`voiceAudio-${peerId}`);
    if (!audio) {
        audio = document.createElement("audio");
        audio.id = `voiceAudio-${peerId}`;
        audio.autoplay = true;
        audio.playsInline = true;
        voiceAudioDockEl.appendChild(audio);
    }

    audio.srcObject = stream;
    audio.play?.().catch(() => {});
    startVoiceLevelMonitor(peerId, stream);
}

function closeVoicePeer(peerId) {
    const peer = voicePeers.get(peerId);
    if (peer) {
        peer.connection.close();
        voicePeers.delete(peerId);
    }

    document.getElementById(`voiceAudio-${peerId}`)?.remove();
    stopVoiceLevelMonitor(peerId);
}

function closeAllVoicePeers() {
    Array.from(voicePeers.keys()).forEach(closeVoicePeer);
}

function createVoicePeer(peerId, peerUsername = "Guest") {
    if (!localMicStream || voicePeers.has(peerId)) {
        return voicePeers.get(peerId)?.connection || null;
    }

    const connection = new RTCPeerConnection(VOICE_RTC_CONFIG);
    voicePeers.set(peerId, {
        connection,
        username: peerUsername
    });

    localMicStream.getTracks().forEach(track => {
        connection.addTrack(track, localMicStream);
    });

    connection.onicecandidate = event => {
        if (!event.candidate) return;

        socket.emit("voiceSignal", {
            room: roomCode,
            target: peerId,
            signal: {
                type: "candidate",
                candidate: event.candidate
            }
        });
    };

    connection.ontrack = event => {
        const [stream] = event.streams;
        if (stream) {
            createRemoteAudio(peerId, stream);
        }
    };

    connection.onconnectionstatechange = () => {
        if (["closed", "failed", "disconnected"].includes(connection.connectionState)) {
            closeVoicePeer(peerId);
        }
    };

    return connection;
}

async function sendVoiceOffer(peerId, peerUsername) {
    const connection = createVoicePeer(peerId, peerUsername);
    if (!connection) return;

    const offer = await connection.createOffer({
        offerToReceiveAudio: true
    });
    await connection.setLocalDescription(offer);

    socket.emit("voiceSignal", {
        room: roomCode,
        target: peerId,
        signal: connection.localDescription
    });
}

async function joinMic() {
    if (isMicJoined) return;

    if (!navigator.mediaDevices?.getUserMedia) {
        addSystemMessage("Microphone is not available in this browser.");
        return;
    }

    micToggleButton.disabled = true;
    if (fullscreenMicToggleButton) fullscreenMicToggleButton.disabled = true;
    micToggleTextEl.textContent = "Joining";

    try {
        localMicStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        socket.emit("voiceJoin", {
            room: roomCode,
            username
        }, async response => {
            micToggleButton.disabled = false;
            if (fullscreenMicToggleButton) fullscreenMicToggleButton.disabled = false;

            if (!response?.ok) {
                localMicStream?.getTracks().forEach(track => track.stop());
                localMicStream = null;
                addSystemMessage(response?.message || "Could not join mic.");
                updateMicButton();
                return;
            }

            isMicJoined = true;
            isMicMuted = false;
            ownVoiceId = response.id || "";
            startVoiceLevelMonitor(ownVoiceId, localMicStream);
            updateVoiceUsers([
                ...(response.peers || []),
                {
                    id: ownVoiceId,
                    username,
                    muted: false
                }
            ]);
            updateMicButton();
            addSystemMessage(`${username} joined mic.`);

            for (const peer of response.peers || []) {
                await sendVoiceOffer(peer.id, peer.username).catch(() => {});
            }
        });
    } catch {
        micToggleButton.disabled = false;
        if (fullscreenMicToggleButton) fullscreenMicToggleButton.disabled = false;
        localMicStream = null;
        addSystemMessage("Microphone permission was blocked or unavailable.");
        updateMicButton();
    }
}

function setMicMuted(muted) {
    if (!localMicStream) return;

    isMicMuted = muted;
    localMicStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
    });
    socket.emit("voiceMute", {
        room: roomCode,
        muted
    });
    if (muted && ownVoiceId) {
        speakingVoiceIds.delete(ownVoiceId);
    }
    updateMicButton();
}

function leaveMic(shouldNotify = true) {
    if (!isMicJoined && !localMicStream) return;

    const leavingVoiceId = ownVoiceId;
    socket.emit("voiceLeave", { room: roomCode });
    localMicStream?.getTracks().forEach(track => track.stop());
    localMicStream = null;
    isMicJoined = false;
    isMicMuted = false;
    ownVoiceId = "";
    closeAllVoicePeers();
    stopVoiceLevelMonitor(leavingVoiceId);
    updateVoiceUsers(Array.from(activeVoiceUsers.values()).filter(user => user.id !== leavingVoiceId));
    updateMicButton();

    if (shouldNotify) {
        addSystemMessage(`${username} left mic.`);
    }
}

micToggleButton?.addEventListener("click", () => {
    if (!isMicJoined) {
        joinMic();
        return;
    }

    setMicMuted(!isMicMuted);
});

micLeaveButton?.addEventListener("click", () => {
    leaveMic();
});

fullscreenMicToggleButton?.addEventListener("click", () => {
    if (!isMicJoined) {
        joinMic();
        return;
    }

    setMicMuted(!isMicMuted);
});

fullscreenMicLeaveButton?.addEventListener("click", () => {
    leaveMic();
});

updateMicButton();

window.addEventListener("beforeunload", () => {
    leaveMic(false);
});

function playbackClockNow() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function withLocalSyncState(state) {
    return {
        ...state,
        localSyncedAt: playbackClockNow()
    };
}

function getSyncedPlaybackTime(state) {
    const baseTime = Number(state?.currentTime) || 0;
    const duration = Number(state?.duration) || 0;

    if (!state || state.paused) {
        return duration > 0 ? Math.min(duration, baseTime) : baseTime;
    }

    const localSyncedAt = Number(state.localSyncedAt) || playbackClockNow();
    const elapsed = Math.max(0, (playbackClockNow() - localSyncedAt) / 1000);
    const liveTime = baseTime + elapsed;

    return duration > 0 ? Math.min(duration, liveTime) : liveTime;
}

function getDisplayPlaybackState(state) {
    if (!state) return null;

    return {
        ...state,
        currentTime: getSyncedPlaybackTime(state)
    };
}

function schedulePlayerWebviewSizeSync() {
    if (playerResizeFrame) return;

    playerResizeFrame = requestAnimationFrame(() => {
        playerResizeFrame = null;
        syncPlayerWebviewSize();
    });
}

function scheduleBrowserWebviewSizeSync() {
    if (browserResizeFrame) return;

    browserResizeFrame = requestAnimationFrame(() => {
        browserResizeFrame = null;
        syncBrowserWebviewSize();
    });
}

function normalizedVideoIdentity(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        const path = parsed.pathname.replace(/\/$/, "");

        if (isYoutubeUrl(url)) {
            const videoId = getYoutubeVideoId(url);
            return videoId ? `youtube:${videoId}` : `${host}${path}`;
        }

        if (isDailymotionUrl(url)) {
            const videoId = getDailymotionVideoId(url);
            return videoId ? `dailymotion:${videoId}` : `${host}${path}`;
        }

        if (isGoogleDriveUrl(url)) {
            const fileId = getGoogleDriveFileId(url);
            return fileId ? `drive:${fileId}` : `${host}${path}`;
        }

        return `${host}${path}`;
    } catch {
        return "";
    }
}

function isSameVideoUrl(firstUrl, secondUrl) {
    const first = normalizedVideoIdentity(firstUrl);
    const second = normalizedVideoIdentity(secondUrl);
    return Boolean(first && second && first === second);
}

async function installPlayerEndGuard() {
    if (!playerWebview || playerWebview.src === "about:blank") return;
    if (isLightYoutubePlayerUrl(playerWebview.src)) return;

    try {
        await playerWebview.executeJavaScript(`
            (() => {
                const findVideos = root => {
                    const videos = Array.from(root.querySelectorAll("video"));

                    for (const frame of root.querySelectorAll("iframe")) {
                        try {
                            videos.push(...Array.from(frame.contentDocument?.querySelectorAll("video") || []));
                        } catch {}
                    }

                    return videos;
                };

                const guardVideo = video => {
                    if (!video || video.__watchPartyEndGuarded) return;

                    video.__watchPartyEndGuarded = true;
                    video.autoplay = false;
                    video.loop = false;
                    video.removeAttribute("autoplay");
                    video.removeAttribute("loop");

                    video.addEventListener("ended", () => {
                        window.__watchPartyEnded = true;
                        video.pause();
                    }, true);

                    video.addEventListener("play", () => {
                        if (window.__watchPartyEnded) {
                            video.pause();
                        }
                    }, true);
                };

                const guardAll = () => {
                    const videos = findVideos(document);
                    videos.forEach(guardVideo);

                    if (window.__watchPartyEnded) {
                        videos.forEach(video => video.pause());
                    }
                };

                guardAll();

                if (!window.__watchPartyEndObserver) {
                    window.__watchPartyEndObserver = new MutationObserver(guardAll);
                    window.__watchPartyEndObserver.observe(document.documentElement, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["src", "autoplay", "loop"]
                    });
                    window.setInterval(guardAll, 350);
                }

                return true;
            })()
        `);
    } catch {}
}

function ensureQueueCountdown() {
    let countdown = document.getElementById("queueCountdown");

    if (countdown) return countdown;

    countdown = document.createElement("div");
    countdown.id = "queueCountdown";
    countdown.className = "queue-countdown";
    countdown.hidden = true;
    countdown.innerHTML = `
        <div class="queue-countdown-ring">
            <span id="queueCountdownNumber">15</span>
        </div>
        <div class="queue-countdown-copy">
            <span class="queue-countdown-label">Up next</span>
            <strong id="queueCountdownTitle">Queued video</strong>
        </div>
        <button id="queuePlayNextNow" class="queue-next-button" type="button">
            Next now
        </button>
    `;

    countdown.querySelector("#queuePlayNextNow")?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        if (!canControlPlayer() || handlingPlaybackEnd) return;
        handlePlaybackEnded();
    });

    playerPane.appendChild(countdown);
    return countdown;
}

function hideQueueCountdown() {
    const countdown = document.getElementById("queueCountdown");
    if (countdown) countdown.hidden = true;
    queueCountdownLastSecond = null;
}

function updateQueueCountdown(state) {
    const nextItem = queueItems[0];
    const duration =
        Number(state?.duration) ||
        Number(lastPlaybackState?.duration) ||
        0;
    const currentTime =
        Number(state?.currentTime) ||
        Number(lastPlaybackState?.currentTime) ||
        0;

    if (!nextItem || !Number.isFinite(duration) || duration <= 0) {
        hideQueueCountdown();
        return;
    }

    const remaining = Math.max(0, duration - currentTime);

    if (remaining > 15 || remaining <= 0.15) {
        hideQueueCountdown();
        return;
    }

    const seconds = Math.max(1, Math.ceil(remaining));
    const countdown = ensureQueueCountdown();

    countdown.querySelector("#queueCountdownNumber").textContent = String(seconds);
    countdown.querySelector("#queueCountdownTitle").textContent =
        nextItem.title || "Queued video";
    countdown.hidden = false;

    if (queueCountdownLastSecond !== seconds) {
        queueCountdownLastSecond = seconds;
        countdown.classList.remove("is-ticking");
        void countdown.offsetWidth;
        countdown.classList.add("is-ticking");
    }
}

async function handlePlaybackEnded() {
    if (!canControlPlayer() || handlingPlaybackEnd) return;

    hideQueueCountdown();
    handlingPlaybackEnd = true;

    try {
        const nextItem = queueItems[0];

        if (nextItem) {
            socket.emit("loadMedia", {
                room: roomCode,
                username,
                url: nextItem.url,
                title: nextItem.title
            });

            socket.emit("removeQueue", {
                room: roomCode,
                id: nextItem.id
            });
        } else {
            socket.emit("stopMedia", {
                room: roomCode,
                username
            });
        }
    } finally {
        setTimeout(() => {
            handlingPlaybackEnd = false;
        }, 1800);
    }
}


function setPlayerEmptyState(isEmpty) {
    const empty = Boolean(isEmpty);
    playerPane.classList.toggle("is-empty", empty);
    playerEmptyStateEl.hidden = !empty;
    if (empty && playerErrorStateEl) {
        playerErrorStateEl.hidden = true;
    }
    playerFullscreenButton.disabled = empty;
    if (empty) {
        clearInterval(playerReadyCheckTimer);
        playerReadyCheckTimer = null;
        clearTimeout(playerLoadingReleaseTimer);
        playerLoadingReleaseTimer = null;
        setPlayerLoading(false);
        updatePlaybackTime({ currentTime: 0, duration: 0, paused: true });
    }
}

function isDrivePlayerMode() {
    const url = selectedVideoUrl || playerWebview.src || "";
    return isGoogleDriveUrl(url) && !isGoogleDriveDirectMediaUrl(url);
}

function setPlayerError(message) {
    clearInterval(playerReadyCheckTimer);
    playerReadyCheckTimer = null;
    clearTimeout(playerLoadingReleaseTimer);
    playerLoadingReleaseTimer = null;
    setPlayerLoading(false);
    setPlayerEmptyState(false);
    if (playerErrorTextEl) {
        playerErrorTextEl.textContent = message || "The player could not load this link.";
    }
    if (playerErrorStateEl) {
        playerErrorStateEl.hidden = false;
    }
    setMediaStatus("Load failed", "is-offline");
}

function clearPlayerError() {
    if (playerErrorStateEl) {
        playerErrorStateEl.hidden = true;
    }
}

function setDriveContinueVisible(isVisible) {
    if (driveContinueStateEl) {
        driveContinueStateEl.hidden = !isVisible;
    }
}

function setPlayerLoading(isLoading, message = "Loading video") {
    if (!playerLoadingStateEl) return;

    const youtubeLoad = isYoutubeUrl(selectedVideoUrl || playerWebview.src || "");

    if (isLoading && !playerPane.classList.contains("is-loading")) {
        playerLoadingStartedAt = playbackClockNow();
    }

    if (isLoading) {
        clearPlayerError();
        setDriveContinueVisible(false);
    }

    playerPane.classList.toggle("is-loading", Boolean(isLoading && !youtubeLoad));
    playerLoadingStateEl.hidden = !isLoading || youtubeLoad;

    if (!isLoading) {
        clearTimeout(playerLoadingReleaseTimer);
        playerLoadingReleaseTimer = null;
        playerLoadingStartedAt = 0;
        restorePlayerMediaAfterLoading();
    }

    const title = playerLoadingStateEl.querySelector("strong");
    if (title) title.textContent = message;

    if (isLoading && !isDrivePlayerMode()) {
        mutePlayerMediaDuringLoading();
    } else {
        restorePlayerMediaAfterLoading();
    }
}

function setBrowserLoading(isLoading, message = "Loading browser") {
    if (!browserLoadingStateEl) return;

    browserPane.classList.toggle("is-loading", Boolean(isLoading));
    browserLoadingStateEl.hidden = !isLoading;

    const title = browserLoadingStateEl.querySelector("strong");
    if (title) title.textContent = message;
}

async function mutePlayerMediaDuringLoading() {
    if (playerWebview.src === "about:blank") return;
    if (isLightYoutubePlayerUrl(playerWebview.src)) return;

    try {
        await playerWebview.executeJavaScript(`
            (() => {
                document.querySelectorAll("video, audio").forEach(media => {
                    if (!media.muted) media.__watchPartyMutedForLoading = true;
                    media.muted = true;
                    media.volume = 0;
                });
            })()
        `);
    } catch {}
}

async function restorePlayerMediaAfterLoading() {
    if (playerWebview.src === "about:blank") return;
    if (isLightYoutubePlayerUrl(playerWebview.src)) return;

    try {
        await playerWebview.executeJavaScript(`
            (() => {
                const player = document.querySelector("#movie_player");
                player?.unMute?.();
                player?.setVolume?.(100);

                document.querySelectorAll("video, audio").forEach(media => {
                    media.style.setProperty("opacity", "1", "important");
                    media.style.setProperty("visibility", "visible", "important");
                    media.style.setProperty("filter", "none", "important");
                    media.playbackRate = 1;

                    if (media.__watchPartyMutedForLoading && !media.__watchPartyMutedForAd) {
                        media.muted = false;
                    }

                    if (!media.__watchPartyMutedForAd) {
                        media.volume = 1;
                    }

                    media.__watchPartyMutedForLoading = false;
                });
            })()
        `);
    } catch {}
}

async function isPlayerReady() {
    if (playerWebview.src === "about:blank") return false;

    try {
        return Boolean(await playerWebview.executeJavaScript(`
            (() => {
                if (window.watchPartyPlayer?.getState) {
                    const state = window.watchPartyPlayer.getState();
                    return Boolean(state?.ready || state?.duration > 0 || state?.currentTime > 0);
                }

                const findVideo = root => {
                    const directVideo = root.querySelector("video");
                    if (directVideo) return directVideo;

                    for (const frame of root.querySelectorAll("iframe")) {
                        try {
                            const nestedVideo = frame.contentDocument?.querySelector("video");
                            if (nestedVideo) return nestedVideo;
                        } catch {}
                    }

                    return null;
                };

                const video = findVideo(document);
                if (!video) return false;

                const isYoutubePage = /(^|\.)youtube(?:-nocookie)?\.com$/i.test(location.hostname) ||
                    /(^|\.)youtu\.be$/i.test(location.hostname);
                const player = document.querySelector("#movie_player");
                const isVisible = element => {
                    if (!element) return false;
                    const rect = element.getBoundingClientRect?.();
                    const style = getComputedStyle(element);
                    return Boolean(rect?.width && rect?.height) &&
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        Number(style.opacity || 1) > 0;
                };
                const visibleAdElement = Array.from(document.querySelectorAll(
                    ".ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-preview-container, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button"
                )).some(isVisible);
                const isAd = isYoutubePage && Boolean(visibleAdElement);

                if (isAd) {
                    document.querySelectorAll(
                        ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button, .ytp-ad-skip-button-container button, button[class*='skip']"
                    ).forEach(button => button.click());

                    document.querySelectorAll("video").forEach(adVideo => {
                        adVideo.muted = true;
                        adVideo.playbackRate = 16;
                        if (Number.isFinite(adVideo.duration) && adVideo.duration > 0) {
                            adVideo.currentTime = Math.max(adVideo.currentTime, adVideo.duration - .05);
                        }
                    });

                    return false;
                }

                const hasData = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
                const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
                const hasFrame = video.videoWidth > 0 && video.videoHeight > 0;

                return Boolean(hasData || hasDuration || hasFrame || !video.paused);
            })()
        `));
    } catch {
        return false;
    }
}

async function recoverYoutubePlayerAfterAdBlock() {
    if (!isYoutubeUrl(selectedVideoUrl || playerWebview.src || "") || playerWebview.src === "about:blank") return false;
    if (isLightYoutubePlayerUrl(playerWebview.src)) return false;

    try {
        return Boolean(await playerWebview.executeJavaScript(`
            (async () => {
                const player = document.querySelector("#movie_player");
                player?.classList?.remove("ad-showing", "ad-interrupting", "ad-created");
                player?.querySelectorAll?.(".ad-showing, .ad-interrupting, .ad-created").forEach(element => {
                    element.classList.remove("ad-showing", "ad-interrupting", "ad-created");
                });

                document.querySelectorAll([
                    ".video-ads",
                    ".ytp-ad-module",
                    ".ytp-ad-overlay-container",
                    ".ytp-ad-player-overlay",
                    ".ytp-ad-image-overlay",
                    ".ytp-ad-text",
                    ".ytp-ad-preview-container",
                    ".ytp-ad-progress-list",
                    "ytd-ad-slot-renderer",
                    "ytd-companion-slot-renderer",
                    "#player-ads"
                ].join(",")).forEach(element => element.remove());

                const video = document.querySelector("video");
                if (!video) return false;

                if (video.playbackRate > 4) video.playbackRate = 1;
                video.style.setProperty("opacity", "1", "important");
                video.style.setProperty("visibility", "visible", "important");
                video.style.setProperty("filter", "none", "important");

                if (video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    await video.play().catch(() => {});
                }

                return Boolean(
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
                    video.videoWidth > 0 ||
                    (Number.isFinite(video.duration) && video.duration > 0)
                );
            })()
        `));
    } catch {
        return false;
    }
}

async function skipYoutubeAdsInPlayer() {
    if (!isYoutubeUrl(selectedVideoUrl || playerWebview.src || "") || playerWebview.src === "about:blank") return false;
    if (isLightYoutubePlayerUrl(playerWebview.src)) return false;

    try {
        return Boolean(await playerWebview.executeJavaScript(`
            (() => {
                const player = document.querySelector("#movie_player");
                const hasAdClass = Boolean(
                    player?.classList?.contains("ad-showing") ||
                    player?.classList?.contains("ad-interrupting")
                );
                const hasAdNode = Boolean(document.querySelector([
                    ".ytp-ad-player-overlay",
                    ".ytp-ad-text",
                    ".ytp-ad-preview-container",
                    ".ytp-ad-skip-button",
                    ".ytp-ad-skip-button-modern",
                    ".ytp-skip-ad-button",
                    ".ytp-ad-simple-ad-badge",
                    ".ytp-ad-player-overlay-instream-info",
                    ".video-ads"
                ].join(",")));

                if (!hasAdClass && !hasAdNode) {
                    document.querySelectorAll("video").forEach(video => {
                        if (video.playbackRate > 4) video.playbackRate = 1;
                    });
                    return false;
                }

                document.querySelectorAll([
                    ".ytp-ad-skip-button",
                    ".ytp-ad-skip-button-modern",
                    ".ytp-skip-ad-button",
                    ".ytp-ad-overlay-close-button",
                    ".ytp-ad-skip-button-container button",
                    "button[class*='skip']"
                ].join(",")).forEach(button => button.click());

                document.querySelectorAll("video").forEach(video => {
                    video.muted = true;
                    video.playbackRate = 16;
                    if (Number.isFinite(video.duration) && video.duration > 0) {
                        video.currentTime = Math.max(video.currentTime, video.duration - 0.05);
                    }
                });

                player?.classList?.remove("ad-showing", "ad-interrupting", "ad-created");
                return true;
            })()
        `));
    } catch {
        return false;
    }
}

async function isFacebookLoginWall() {
    if (!isFacebookUrl(playerWebview.src)) return false;

    try {
        return Boolean(await playerWebview.executeJavaScript(`
            (() => {
                const path = location.pathname.toLowerCase();
                const text = document.body?.innerText?.toLowerCase?.() || "";
                const hasLoginForm = Boolean(
                    document.querySelector("input[name='email'], input[name='pass'], form[action*='login']")
                );
                const hasPlayableVideo = Array.from(document.querySelectorAll("video")).some(video =>
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
                    video.videoWidth > 0 ||
                    (Number.isFinite(video.duration) && video.duration > 0)
                );
                const hasQrOrCheckpointText =
                    text.includes("scan") ||
                    text.includes("qr") ||
                    text.includes("two-factor") ||
                    text.includes("checkpoint");
                const hasLoginText = text.includes("log in") || text.includes("login");

                return hasLoginForm ||
                    path.includes("/login") ||
                    path.includes("/checkpoint") ||
                    hasQrOrCheckpointText ||
                    (hasLoginText && !hasPlayableVideo);
            })()
        `));
    } catch {
        return false;
    }
}

function waitForPlayerReady() {
    clearInterval(playerReadyCheckTimer);
    clearPlayerAutoplayNudges();
    const readyUrl = String(selectedVideoUrl || playerWebview.src || "").trim();
    const canShowLoading = readyUrl !== lastPlayerReadyUrl || playerPane.classList.contains("is-empty");
    if (canShowLoading) {
        setPlayerLoading(true);
    } else {
        setPlayerLoading(false);
    }

    const youtubeLoad = isYoutubeUrl(selectedVideoUrl || playerWebview.src || "");
    const driveLoad = isGoogleDriveUrl(selectedVideoUrl || playerWebview.src || "");
    const lightYoutubePlayer = isLightYoutubePlayerUrl(playerWebview.src);
    let checks = 0;
    const finishReady = () => {
        clearInterval(playerReadyCheckTimer);
        playerReadyCheckTimer = null;
        clearTimeout(playerLoadingReleaseTimer);
        playerLoadingReleaseTimer = null;
        lastPlayerReadyUrl = readyUrl;
        setPlayerLoading(false);
        setMediaStatus("Ready", "is-online");
        schedulePlayerAutoplayNudge();
    };

    if (youtubeLoad) {
        const loadingAge = playerLoadingStartedAt
            ? playbackClockNow() - playerLoadingStartedAt
            : 0;
        const releaseDelay = Math.max(0, 2200 - loadingAge);

        clearTimeout(playerLoadingReleaseTimer);
        playerLoadingReleaseTimer = setTimeout(() => {
            recoverYoutubePlayerAfterAdBlock();
            finishReady();
        }, releaseDelay);
    }

    if (driveLoad) {
        clearTimeout(playerLoadingReleaseTimer);
        playerLoadingReleaseTimer = setTimeout(() => {
            finishReady();
        }, 900);
    }

    playerReadyCheckTimer = setInterval(async () => {
        checks += 1;

        if (youtubeLoad && playerLoadingStartedAt && playbackClockNow() - playerLoadingStartedAt > 2200) {
            if (!lightYoutubePlayer) {
                recoverYoutubePlayerAfterAdBlock();
            }
            finishReady();
            return;
        }

        if (!driveLoad && !lightYoutubePlayer && (!youtubeLoad || checks < 8)) {
            mutePlayerMediaDuringLoading();
        }
        if (!driveLoad && !lightYoutubePlayer && checks % 2 === 0) {
            cleanPlayerView();
        }

        if (await isFacebookLoginWall()) {
            clearInterval(playerReadyCheckTimer);
            playerReadyCheckTimer = null;
            clearTimeout(playerLoadingReleaseTimer);
            playerLoadingReleaseTimer = null;
            setPlayerLoading(false);
            setMediaStatus("Facebook login required", "is-offline");
            return;
        }

        if (!lightYoutubePlayer && youtubeLoad && checks > 8 && await recoverYoutubePlayerAfterAdBlock()) {
            finishReady();
            return;
        }

        if (await isPlayerReady()) {
            finishReady();
            return;
        }

        if (checks > (youtubeLoad ? 16 : driveLoad ? 12 : 42)) {
            const hasPlayableVideo = await hasPlayerVideoWithData();

            if (hasPlayableVideo) {
                finishReady();
                return;
            }
        }

        if (checks > (youtubeLoad ? 14 : 80)) {
            finishReady();
        }
    }, lightYoutubePlayer ? 320 : 180);
}

function clearPlayerAutoplayNudges() {
    playerAutoplayTimers.forEach(timer => clearTimeout(timer));
    playerAutoplayTimers = [];
}

function schedulePlayerAutoplayNudge() {
    clearPlayerAutoplayNudges();

    if (!canControlPlayer() || playerWebview.src === "about:blank") return;

    const delays = [120, 650, 1400];
    delays.forEach(delay => {
        const timer = setTimeout(async () => {
            if (!canControlPlayer() || applyingRemotePlayback || playerWebview.src === "about:blank") return;

            const state = await readPlaybackState();

            if (!state || state.ended || state.paused === false) return;

            const nextState = await setPlayerPaused(false);

            if (nextState) {
                lastPlaybackState = withLocalSyncState({
                    ...nextState,
                    paused: false,
                    updatedAt: Date.now()
                });
                updatePlaybackTime(getDisplayPlaybackState(lastPlaybackState));
                emitHostPlaybackState(false);
            }
        }, delay);
        playerAutoplayTimers.push(timer);
    });
}

async function hasPlayerVideoWithData() {
    if (playerWebview.src === "about:blank") return false;

    try {
        return Boolean(await playerWebview.executeJavaScript(`
            (() => {
                if (window.watchPartyPlayer?.getState) {
                    const state = window.watchPartyPlayer.getState();
                    return Boolean(state?.ready || state?.duration > 0 || state?.currentTime > 0);
                }

                const video = document.querySelector("video");
                if (!video) return false;

                return Boolean(
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
                    video.videoWidth > 0 ||
                    (Number.isFinite(video.duration) && video.duration > 0)
                );
            })()
        `));
    } catch {
        return false;
    }
}

function syncWebviewToPane(pane, webview) {
    if (!pane || !webview || pane.hidden) return;

    const width = Math.max(1, Math.round(pane.clientWidth));
    const height = Math.max(1, Math.round(pane.clientHeight));

    Object.assign(webview.style, {
        position: "absolute",
        inset: "0",
        width: `${width}px`,
        height: `${height}px`,
        minWidth: "0",
        minHeight: "0",
        maxWidth: `${width}px`,
        maxHeight: `${height}px`
    });
}

function syncPlayerWebviewSize() {
    syncWebviewToPane(playerPane, playerWebview);
    if (driveBrowserPromotedToPlayer) {
        syncWebviewToPane(playerPane, browserWebview);
    }
}

function syncBrowserWebviewSize() {
    if (driveBrowserPromotedToPlayer) return;
    syncWebviewToPane(browserPane, browserWebview);
}

function syncAllWebviewSizes() {
    syncPlayerWebviewSize();
    syncBrowserWebviewSize();
}

const playerPaneResizeObserver = new ResizeObserver(() => {
    schedulePlayerWebviewSizeSync();
});

const browserPaneResizeObserver = new ResizeObserver(() => {
    scheduleBrowserWebviewSizeSync();
});

playerPaneResizeObserver.observe(playerPane);
browserPaneResizeObserver.observe(browserPane);
window.addEventListener("resize", syncAllWebviewSizes);
requestAnimationFrame(syncAllWebviewSizes);
setPlayerEmptyState(true);

function sameDriveFileUrl(leftUrl, rightUrl) {
    const leftId = getGoogleDriveFileId(leftUrl);
    const rightId = getGoogleDriveFileId(rightUrl);

    if (leftId && rightId) return leftId === rightId;

    return isSameVideoUrl(leftUrl, rightUrl);
}

function promoteDriveBrowserToPlayer(url = "") {
    if (!browserWebview || !playerPane || !browserPane) return false;

    const browserUrl = getCurrentBrowserUrl();
    const targetUrl = url || browserUrl;

    if (!isGoogleDriveVideoUrl(targetUrl)) return false;
    if (!browserUrl || !sameDriveFileUrl(browserUrl, targetUrl)) return false;

    if (!driveBrowserPromotedToPlayer) {
        playerPane.appendChild(browserWebview);
        driveBrowserPromotedToPlayer = true;
    }

    playerWebview.src = "about:blank";
    playerWebview.hidden = true;
    playerPane.classList.add("is-drive-player", "is-drive-browser-player");
    browserPane.classList.add("is-browser-promoted");
    browserPane.classList.remove("is-loading");

    setPlayerEmptyState(false);
    setPlayerLoading(false);
    clearPlayerError();
    setDriveContinueVisible(false);
    syncPlayerWebviewSize();
    cleanPromotedDrivePlayer();
    setMediaStatus("Drive playing from browser", "is-online");
    updateHostControls();
    return true;
}

async function cleanPromotedDrivePlayer() {
    if (!driveBrowserPromotedToPlayer) return false;

    try {
        const cleaned = await browserWebview.executeJavaScript(`
            (() => {
                const styleId = "watch-party-drive-theater";
                const css = \`
                    html,
                    body {
                        width: 100vw !important;
                        height: 100vh !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background: #000 !important;
                    }

                    [role="banner"],
                    header,
                    nav,
                    [aria-label="Toolbar"],
                    [class*="header"],
                    [class*="toolbar"],
                    [class*="Toolbar"],
                    [class*="topbar"],
                    [class*="TopBar"] {
                        display: none !important;
                    }

                    video {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        max-width: none !important;
                        max-height: none !important;
                        object-fit: contain !important;
                        object-position: center center !important;
                        background: #000 !important;
                        z-index: 2147483647 !important;
                    }
                \`;

                let style = document.getElementById(styleId);
                if (!style) {
                    style = document.createElement("style");
                    style.id = styleId;
                    document.documentElement.appendChild(style);
                }
                style.textContent = css;

                const video = document.querySelector("video");
                if (!video) return false;

                video.style.position = "fixed";
                video.style.inset = "0";
                video.style.width = "100vw";
                video.style.height = "100vh";
                video.style.maxWidth = "none";
                video.style.maxHeight = "none";
                video.style.objectFit = "contain";
                video.style.objectPosition = "center center";
                video.style.zIndex = "2147483647";
                video.controls = true;
                video.scrollIntoView({ block: "center", inline: "center" });
                return true;
            })()
        `);

        [250, 750, 1500, 3000].forEach(delay => {
            setTimeout(() => {
                if (driveBrowserPromotedToPlayer) {
                    cleanPromotedDrivePlayer();
                }
            }, delay);
        });

        return Boolean(cleaned);
    } catch {
        return false;
    }
}

function restoreDriveBrowserToBrowserPane() {
    if (!driveBrowserPromotedToPlayer || !browserWebview || !browserPane) return;

    browserPane.appendChild(browserWebview);
    driveBrowserPromotedToPlayer = false;
    browserPane.classList.remove("is-browser-promoted");
    playerPane.classList.remove("is-drive-browser-player");
    playerWebview.hidden = false;
    requestAnimationFrame(syncAllWebviewSizes);
}

codeEl.innerText = roomCode || "------";
mediaUrlInput.value = activeBrowserHome;
messageInput.disabled = false;
messageInput.readOnly = false;

function appendChatNode(container, node) {
    if (!container || !node) return;
    container.appendChild(node);
    container.scrollTop = container.scrollHeight;
}

function markAnimatedNode(node, className) {
    if (!node || !className) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    node.addEventListener("animationend", () => {
        node.classList.remove(className);
    }, { once: true });
}

function getQueueAnimationKey(item, index = 0) {
    const source = item?.url || item?.title || item?.id || `queue-${index}`;
    return String(source).trim().toLowerCase();
}

function cleanDisplayName(value) {
    return String(value || "Guest").trim().slice(0, 18) || "Guest";
}

function createMessageElement({ username: sender, message, sentAt }) {
    const messageEl = document.createElement("article");
    messageEl.className = sender === username ? "message is-mine" : "message";

    const metaEl = document.createElement("div");
    metaEl.className = "message-meta";

    const nameEl = document.createElement("strong");
    nameEl.textContent = sender;

    const timeEl = document.createElement("span");
    timeEl.textContent = new Date(sentAt || Date.now()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    const textEl = document.createElement("p");
    textEl.textContent = message;

    metaEl.append(nameEl, timeEl);
    messageEl.append(metaEl, textEl);
    return messageEl;
}

function addMessage(messageData) {
    const messageEl = createMessageElement(messageData);
    markAnimatedNode(messageEl, "message-entering");
    appendChatNode(messagesEl, messageEl);
    const fullscreenMessageEl = messageEl.cloneNode(true);
    markAnimatedNode(fullscreenMessageEl, "message-entering");
    appendChatNode(fullscreenMessagesEl, fullscreenMessageEl);
    notifyCompactChatMessage();
}

function createSystemMessageElement(message) {
    const item = document.createElement("div");
    item.className = "system-message";
    item.textContent = message;
    return item;
}

function addSystemMessage(message) {
    const item = createSystemMessageElement(message);
    markAnimatedNode(item, "message-entering");
    appendChatNode(messagesEl, item);
    const fullscreenItem = item.cloneNode(true);
    markAnimatedNode(fullscreenItem, "message-entering");
    appendChatNode(fullscreenMessagesEl, fullscreenItem);
}

function isCompactLayout() {
    return window.matchMedia?.("(max-width: 980px)").matches;
}

function clampCompactChatHeight(height) {
    const viewportHeight = window.innerHeight || 720;
    const minHeight = Math.min(230, viewportHeight - 80);
    const maxHeight = Math.max(minHeight, Math.min(520, viewportHeight - 96));
    return Math.round(Math.min(Math.max(height, minHeight), maxHeight));
}

function setCompactChatHeight(height, shouldPersist = false) {
    const nextHeight = clampCompactChatHeight(height);
    document.documentElement.style.setProperty("--compact-chat-height", `${nextHeight}px`);

    if (shouldPersist) {
        localStorage.setItem("watchPartyCompactChatHeight", String(nextHeight));
    }
}

function restoreCompactChatHeight() {
    const savedHeight = Number(localStorage.getItem("watchPartyCompactChatHeight"));
    if (Number.isFinite(savedHeight) && savedHeight > 0) {
        setCompactChatHeight(savedHeight, false);
    }
}

function setCompactChatOpen(isOpen) {
    if (!isCompactLayout()) return;

    document.body.classList.toggle("compact-chat-hidden", !isOpen);
    compactChatToggleButton?.setAttribute("aria-pressed", String(isOpen));
    compactChatToggleButton?.setAttribute("aria-label", isOpen ? "Hide chat" : "Show chat");

    if (isOpen) {
        compactChatUnreadCount = 0;
        if (compactChatBadgeEl) {
            compactChatBadgeEl.hidden = true;
            compactChatBadgeEl.textContent = "0";
        }
    }
}

function notifyCompactChatMessage() {
    if (!compactChatToggleButton || !isCompactLayout()) return;
    if (!document.body.classList.contains("compact-chat-hidden")) return;

    compactChatUnreadCount = Math.min(compactChatUnreadCount + 1, 99);
    if (compactChatBadgeEl) {
        compactChatBadgeEl.hidden = false;
        compactChatBadgeEl.textContent = String(compactChatUnreadCount);
    }
}

function setCompactBrowserOpen(isOpen) {
    if (!isCompactLayout()) return;

    document.body.classList.toggle("compact-browser-hidden", !isOpen);
    compactBrowserToggleButton?.classList.toggle("is-active", isOpen);
    compactBrowserToggleButton?.setAttribute("aria-pressed", String(isOpen));
    compactBrowserToggleButton?.setAttribute("aria-label", isOpen ? "Hide browser" : "Show browser");
    if (compactBrowserToggleButton) {
        compactBrowserToggleButton.title = isOpen ? "Hide browser" : "Show browser";
    }
}

function syncCompactLayoutState() {
    if (!isCompactLayout()) {
        document.body.classList.remove("compact-chat-hidden", "compact-browser-hidden");
        compactChatToggleButton?.setAttribute("aria-pressed", "true");
        compactBrowserToggleButton?.classList.remove("is-active");
        compactBrowserToggleButton?.setAttribute("aria-pressed", "false");
        return;
    }

    restoreCompactChatHeight();

    if (!compactBrowserTouched) {
        setCompactBrowserOpen(false);
    }
}

let effectAudioContext = null;
let effectImpactTimer = null;
let effectImpactReleaseTimer = null;
const EFFECT_IMPACT_DELAY_MS = 1020;

function getEffectAudioContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!effectAudioContext) {
        effectAudioContext = new AudioContextCtor();
    }
    if (effectAudioContext.state === "suspended") {
        effectAudioContext.resume().catch(() => {});
    }
    return effectAudioContext;
}

function scheduleEffectTone(ctx, startAt, frequency, duration, gainValue, type = "sine", destination = null) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(destination || ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.04);
}

function scheduleEffectSweepTone(ctx, startAt, fromFrequency, toFrequency, duration, gainValue, type = "sine", destination = null) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(toFrequency, startAt + duration);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(destination || ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.04);
}

function scheduleEffectNoise(ctx, startAt, duration, gainValue, options = {}, destination = null) {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = options.type || "highpass";
    filter.frequency.setValueAtTime(options.fromFrequency || 900, startAt);
    if (options.toFrequency) {
        filter.frequency.exponentialRampToValueAtTime(options.toFrequency, startAt + duration);
    }
    gain.gain.setValueAtTime(gainValue, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination || ctx.destination);
    source.start(startAt);
    source.stop(startAt + duration + 0.03);
}

function createPremiumEffectBus(ctx, startAt) {
    const input = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const master = ctx.createGain();
    const delay = ctx.createDelay(0.32);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();

    compressor.threshold.setValueAtTime(-22, startAt);
    compressor.knee.setValueAtTime(20, startAt);
    compressor.ratio.setValueAtTime(4, startAt);
    compressor.attack.setValueAtTime(0.006, startAt);
    compressor.release.setValueAtTime(0.16, startAt);
    master.gain.setValueAtTime(0.92, startAt);
    delay.delayTime.setValueAtTime(0.118, startAt);
    feedback.gain.setValueAtTime(0.18, startAt);
    wet.gain.setValueAtTime(0.16, startAt);

    input.connect(compressor);
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(compressor);
    compressor.connect(master);
    master.connect(ctx.destination);

    window.setTimeout(() => {
        input.disconnect();
        compressor.disconnect();
        delay.disconnect();
        feedback.disconnect();
        wet.disconnect();
        master.disconnect();
    }, 3200);

    return input;
}

function playPremiumEffectSound(effectType) {
    const ctx = getEffectAudioContext();
    if (!ctx) return;

    const startAt = ctx.currentTime + 0.012;
    const isCat = effectType === "cat";
    const isBolt = effectType === "bolt";
    const isStar = effectType === "star";
    const bus = createPremiumEffectBus(ctx, startAt);
    const impactAt = startAt + 1.04;
    const base = isBolt ? 520 : isCat ? 330 : isStar ? 480 : 430;
    const sparkleBase = isBolt ? 1740 : isCat ? 980 : isStar ? 1560 : 1320;

    scheduleEffectNoise(ctx, startAt, .5, .012, {
        type: "bandpass",
        fromFrequency: 520,
        toFrequency: 6200
    }, bus);
    scheduleEffectSweepTone(ctx, startAt, base, base * 2.12, .48, .028, "sine", bus);
    scheduleEffectSweepTone(ctx, startAt + .08, base * 1.5, base * 3.1, .46, .018, "triangle", bus);
    scheduleEffectTone(ctx, startAt + .18, sparkleBase, .18, .018, "sine", bus);
    scheduleEffectTone(ctx, startAt + .36, sparkleBase * 1.25, .18, .014, "sine", bus);
    scheduleEffectTone(ctx, startAt + .62, sparkleBase * 1.5, .2, .012, "triangle", bus);
    scheduleEffectSweepTone(ctx, startAt + .82, isCat ? 740 : 1040, isCat ? 1180 : 1680, .25, .02, "sine", bus);

    scheduleEffectNoise(ctx, impactAt - .02, .16, .105, {
        type: "highpass",
        fromFrequency: 900,
        toFrequency: 7600
    }, bus);
    scheduleEffectNoise(ctx, impactAt + .03, .34, .035, {
        type: "bandpass",
        fromFrequency: 1800,
        toFrequency: 3400
    }, bus);
    scheduleEffectSweepTone(ctx, impactAt, isBolt ? 190 : isCat ? 120 : 150, isBolt ? 84 : isCat ? 58 : 72, .16, .11, "sine", bus);
    scheduleEffectTone(ctx, impactAt + .035, isCat ? 740 : 980, .18, .04, "triangle", bus);
    scheduleEffectTone(ctx, impactAt + .075, isCat ? 1110 : 1460, .16, .034, "sine", bus);
    scheduleEffectTone(ctx, impactAt + .13, isCat ? 1480 : 1960, .14, .022, "sine", bus);

    scheduleEffectTone(ctx, impactAt + .24, sparkleBase * 1.45, .1, .018, "sine", bus);
    scheduleEffectTone(ctx, impactAt + .32, sparkleBase * 1.9, .09, .014, "triangle", bus);
    scheduleEffectNoise(ctx, impactAt + .38, .12, .018, {
        type: "highpass",
        fromFrequency: 2600,
        toFrequency: 9200
    }, bus);
    scheduleEffectTone(ctx, impactAt + .55, sparkleBase * 1.22, .16, .011, "sine", bus);
    scheduleEffectTone(ctx, impactAt + .74, sparkleBase * .9, .18, .008, "triangle", bus);
}

function triggerPremiumEffectImpact() {
    if (document.fullscreenElement !== playerStage || !playerStage) return;

    window.clearTimeout(effectImpactTimer);
    window.clearTimeout(effectImpactReleaseTimer);
    effectImpactTimer = window.setTimeout(() => {
        fullscreenEffectsEl?.classList.add("is-effect-impacting");
        playerStage.classList.add("is-effect-impacting");
        effectImpactReleaseTimer = window.setTimeout(() => {
            fullscreenEffectsEl?.classList.remove("is-effect-impacting");
            playerStage.classList.remove("is-effect-impacting");
        }, 440);
    }, EFFECT_IMPACT_DELAY_MS);
}

function setConnection(message, statusClass) {
    connectionEl.textContent = message;
    connectionEl.className = `connection ${statusClass}`;
}

function setRoomLoading(isLoading, title = "Connecting to room", text = "Waiting for the watch party server") {
    if (!roomLoadingOverlay) return;

    roomLoadingOverlay.hidden = !isLoading;
    if (roomLoadingTitle) roomLoadingTitle.textContent = title;
    if (roomLoadingText) roomLoadingText.textContent = text;
}

function setMediaStatus(message, statusClass = "") {
    mediaStatusEl.textContent = message;
    mediaStatusEl.className = `media-status ${statusClass}`.trim();
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
    return isBilibiliUrl(url) || isYoutubeUrl(url) || isDailymotionUrl(url) || isFacebookUrl(url) || isGoogleDriveUrl(url) || isGoogleDriveApiStreamUrl(url);
}

function isBrowserAuthUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (
            parsedUrl.origin === APP_SERVER_ORIGIN &&
            parsedUrl.pathname.toLowerCase().startsWith("/api/drive/")
        ) {
            return true;
        }

        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const allowedHosts = [
            "accounts.google.com",
            "facebook.com",
            "drive.google.com",
            "docs.google.com",
            "googleusercontent.com",
            "google.com",
            "passport.bilibili.com",
            "passport.bilibili.tv"
        ];

        return allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
    } catch {
        return false;
    }
}

function isAllowedBrowserUrl(url) {
    return url === "about:blank" || isSupportedMediaUrl(url) || isBrowserAuthUrl(url);
}

function isBilibiliVideoUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname.toLowerCase();

        return isBilibiliUrl(url) && (
            path.includes("/video/") ||
            path.includes("/bangumi/play/") ||
            path.includes("/play/")
        );
    } catch {
        return false;
    }
}

function isYoutubeVideoUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname.toLowerCase();

        return isYoutubeUrl(url) && (
            parsedUrl.searchParams.has("v") ||
            path.startsWith("/watch") ||
            path.startsWith("/shorts/") ||
            path.startsWith("/embed/") ||
            path.startsWith("/live/") ||
            parsedUrl.hostname.replace(/^www\./, "").toLowerCase() === "youtu.be"
        );
    } catch {
        return false;
    }
}

function isDailymotionVideoUrl(url) {
    return Boolean(getDailymotionVideoId(url));
}

function isFacebookVideoUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const path = parsedUrl.pathname.toLowerCase();

        if (!isFacebookUrl(url)) return false;
        if (host === "fb.watch") return path.length > 1;

        return (
            parsedUrl.searchParams.has("v") ||
            (path.startsWith("/watch/") && path !== "/watch/") ||
            path.startsWith("/reel/") ||
            path.includes("/videos/") ||
            path.includes("/share/v/")
        );
    } catch {
        return false;
    }
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

function isGoogleDriveVideoUrl(url) {
    return Boolean(getGoogleDriveFileId(url)) || isGoogleDriveDirectMediaUrl(url);
}

function isGoogleDriveDirectMediaUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.toLowerCase();
        const path = parsedUrl.pathname.toLowerCase();

        return (
            host.includes("googleusercontent.com") ||
            host.includes("googlevideo.com") ||
            host.includes("usercontent.google.com") ||
            path.includes("videoplayback")
        );
    } catch {
        return false;
    }
}

function isGoogleDriveApiStreamUrl(url) {
    try {
        const parsedUrl = new URL(url, window.location.href);
        return parsedUrl.origin === APP_SERVER_ORIGIN &&
            parsedUrl.pathname.toLowerCase().startsWith("/api/drive/stream/");
    } catch {
        return false;
    }
}

function isIgnorableGoogleAssetUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.toLowerCase();
        const path = parsedUrl.pathname.toLowerCase();

        return (
            (
                host.endsWith("googleusercontent.com") ||
                host.endsWith("gstatic.com") ||
                host.endsWith("google.com")
            ) &&
            (
                host.startsWith("lh") ||
                path.match(/\.(png|jpe?g|gif|webp|svg|ico)$/i) ||
                path.includes("/ogw/") ||
                path.includes("/favicon") ||
                path.includes("/avatar")
            )
        );
    } catch {
        return false;
    }
}

function isYoutubePlayerShellUrl(url) {
    try {
        const parsedUrl = new URL(url, window.location.href);
        return (
            parsedUrl.protocol === "file:" ||
            parsedUrl.origin === APP_SERVER_ORIGIN
        ) &&
            parsedUrl.pathname.replace(/\\/g, "/").endsWith("/youtube-player.html");
    } catch {
        return false;
    }
}

function isYoutubeEmbedPlayerUrl(url) {
    try {
        const parsedUrl = new URL(url, window.location.href);
        return isYoutubeUrl(parsedUrl.href) &&
            parsedUrl.pathname.toLowerCase().startsWith("/embed/");
    } catch {
        return false;
    }
}

function isLightYoutubePlayerUrl(url) {
    return isYoutubePlayerShellUrl(url) || isYoutubeEmbedPlayerUrl(url);
}

function isFacebookEmbedUrl(url) {
    try {
        const parsedUrl = new URL(url, window.location.href);
        return isFacebookUrl(parsedUrl.href) && parsedUrl.pathname.toLowerCase().startsWith("/plugins/video.php");
    } catch {
        return false;
    }
}

function isSupportedVideoUrl(url) {
    return isBilibiliVideoUrl(url) || isYoutubeVideoUrl(url) || isDailymotionVideoUrl(url) || isFacebookVideoUrl(url) || isGoogleDriveVideoUrl(url) || isGoogleDriveApiStreamUrl(url);
}

function getYoutubeVideoId(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const parts = parsedUrl.pathname.split("/").filter(Boolean);

        if (parsedUrl.searchParams.has("v")) {
            return parsedUrl.searchParams.get("v") || "";
        }

        if (host === "youtu.be") {
            return parts[0] || "";
        }

        if (["shorts", "embed", "live"].includes(parts[0])) {
            return parts[1] || "";
        }

        return "";
    } catch {
        return "";
    }
}

function getDailymotionVideoId(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
        const parts = parsedUrl.pathname.split("/").filter(Boolean);

        if (!isDailymotionUrl(url)) return "";

        if (parsedUrl.searchParams.has("video")) {
            return parsedUrl.searchParams.get("video") || "";
        }

        if (host === "dai.ly") {
            return parts[0] || "";
        }

        if (parts[0] === "embed" && parts[1] === "video") {
            return parts[2] || "";
        }

        if (parts[0] === "video") {
            return parts[1] || "";
        }

        return "";
    } catch {
        return "";
    }
}

function getDailymotionEmbedUrl(url) {
    const videoId = getDailymotionVideoId(url);
    if (!videoId) return "";

    const embedUrl = new URL(`https://www.dailymotion.com/embed/video/${encodeURIComponent(videoId)}`);
    embedUrl.searchParams.set("autoplay", "1");
    embedUrl.searchParams.set("controls", "0");
    embedUrl.searchParams.set("queue-enable", "false");
    return embedUrl.toString();
}

function getFacebookEmbedUrl(url) {
    if (!isFacebookVideoUrl(url)) return "";

    try {
        const embedUrl = new URL("https://www.facebook.com/plugins/video.php");
        embedUrl.searchParams.set("href", url);
        embedUrl.searchParams.set("show_text", "false");
        embedUrl.searchParams.set("autoplay", "true");
        embedUrl.searchParams.set("mute", "false");
        return embedUrl.toString();
    } catch {
        return "";
    }
}

function getGoogleDrivePreviewUrl(url) {
    const fileId = getGoogleDriveFileId(url);
    if (!fileId) return url;

    return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function getGoogleDriveDirectUrl(url) {
    const fileId = getGoogleDriveFileId(url);
    if (!fileId) return url;

    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

function getGoogleDriveApiStreamUrl(url) {
    const fileId = getGoogleDriveFileId(url);
    if (!fileId) return url;

    return `${APP_SERVER_ORIGIN}/api/drive/stream/${encodeURIComponent(fileId)}`;
}

function isGoogleDrivePreviewUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return isGoogleDriveUrl(url) && parsedUrl.pathname.toLowerCase().includes("/preview");
    } catch {
        return false;
    }
}

function getPlayerUrl(url) {
    if (isGoogleDriveDirectMediaUrl(url)) {
        return url;
    }

    if (isYoutubeVideoUrl(url)) {
        const videoId = getYoutubeVideoId(url);

        if (videoId) {
            const playerUrl = new URL("/youtube-player.html", APP_SERVER_ORIGIN);
            playerUrl.searchParams.set("videoId", videoId);
            return playerUrl.toString();
        }
    }

    if (isDailymotionVideoUrl(url)) {
        return getDailymotionEmbedUrl(url) || url;
    }

    if (isFacebookVideoUrl(url)) {
        return getFacebookEmbedUrl(url) || url;
    }

    if (isGoogleDriveVideoUrl(url)) {
        return getGoogleDriveApiStreamUrl(url);
    }

    return url;
}

function loadPlayerWebviewUrl(url) {
    const playerUrl = getPlayerUrl(url);

    if (!isGoogleDriveUrl(url) || isGoogleDriveDirectMediaUrl(url)) {
        restoreDriveBrowserToBrowserPane();
    }

    clearPlayerError();
    if (!isGoogleDriveUrl(url)) {
        driveFallbackAttemptedFor = "";
    }
    playerPane.classList.toggle("is-drive-player", isGoogleDriveUrl(url));
    playerWebview.src = playerUrl;
}

function loadDriveFallbackPlayer(reason = "Drive preview failed") {
    setMediaStatus(reason, "is-offline");
    return false;
}

async function continueDriveDownloadConfirmation() {
    if (!isDrivePlayerMode() || !selectedVideoUrl) return false;
    if (driveConfirmAttemptedFor === selectedVideoUrl) return false;

    try {
        const didContinue = await playerWebview.executeJavaScript(`
            (() => {
                const text = (document.body?.innerText || "").toLowerCase();
                const isConfirmPage =
                    text.includes("google drive can't scan this file for viruses") ||
                    text.includes("download anyway") ||
                    text.includes("too large for google to scan");

                if (!isConfirmPage) return false;

                const candidates = Array.from(document.querySelectorAll("a, button, input[type='submit']"));
                const target = candidates.find(element =>
                    /download anyway/i.test(element.innerText || element.value || element.getAttribute("aria-label") || "")
                );

                if (target) {
                    target.click();
                    return true;
                }

                const form = document.querySelector("form");
                if (form) {
                    form.submit();
                    return true;
                }

                return false;
            })()
        `);

        if (didContinue) {
            driveConfirmAttemptedFor = selectedVideoUrl;
            setPlayerLoading(true, "Continuing Drive download");
            setMediaStatus("Continuing Drive download", "");
            return true;
        }
    } catch {}

    return false;
}

async function isDriveDownloadConfirmationPage() {
    if (!isDrivePlayerMode() || playerWebview.src === "about:blank") return false;

    try {
        return Boolean(await playerWebview.executeJavaScript(`
            (() => {
                const text = (document.body?.innerText || "").toLowerCase();
                return text.includes("google drive can't scan this file for viruses") ||
                    text.includes("download anyway") ||
                    text.includes("too large for google to scan");
            })()
        `));
    } catch {
        return false;
    }
}

async function inspectDrivePlayerPage() {
    if (!isDrivePlayerMode() || playerWebview.src === "about:blank") return;

    try {
        if (await isDriveDownloadConfirmationPage()) {
            setPlayerLoading(false);
            setDriveContinueVisible(true);
            setMediaStatus("Drive needs confirmation", "is-offline");
            return;
        }

        const result = await playerWebview.executeJavaScript(`
            (() => {
                const text = (document.body?.innerText || "").toLowerCase();
                const hasVideo = Boolean(document.querySelector("video"));
                const blockedText =
                    text.includes("no preview available") ||
                    text.includes("couldn't preview") ||
                    text.includes("could not preview") ||
                    text.includes("you need access") ||
                    text.includes("request access") ||
                    text.includes("sign in") ||
                    text.includes("too many users have viewed or downloaded");

                return { hasVideo, blockedText, text: text.slice(0, 220) };
            })()
        `);

        if (result?.blockedText && !result?.hasVideo) {
            setMediaStatus("Drive preview needs interaction", "is-offline");
        }
    } catch {}
}

function getYoutubeEmbedFallbackUrl(url) {
    const videoId = getYoutubeVideoId(url);
    if (!videoId) return "";

    const embedUrl = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
    embedUrl.searchParams.set("autoplay", "1");
    embedUrl.searchParams.set("controls", "0");
    embedUrl.searchParams.set("disablekb", "1");
    embedUrl.searchParams.set("enablejsapi", "1");
    embedUrl.searchParams.set("fs", "0");
    embedUrl.searchParams.set("iv_load_policy", "3");
    embedUrl.searchParams.set("modestbranding", "1");
    embedUrl.searchParams.set("playsinline", "1");
    embedUrl.searchParams.set("rel", "0");
    embedUrl.searchParams.set("origin", APP_SERVER_ORIGIN);
    return embedUrl.toString();
}

function loadYoutubeEmbedFallbackPlayer() {
    if (!selectedVideoUrl || !isYoutubeVideoUrl(selectedVideoUrl)) return false;

    const fallbackUrl = getYoutubeEmbedFallbackUrl(selectedVideoUrl);
    if (!fallbackUrl || playerWebview.src === fallbackUrl) return false;

    playerWebview.src = fallbackUrl;
    setMediaStatus("Loading YouTube", "");
    return true;
}

function supportedSitesLabel() {
    return "Bilibili, YouTube, Dailymotion, Facebook, or Google Drive";
}

function getSupportedMediaUrl() {
    const rawUrl = mediaUrlInput.value.trim();

    if (!rawUrl) {
        setMediaStatus("Paste a link", "is-offline");
        mediaUrlInput.focus();
        return null;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    try {
        const parsedUrl = new URL(normalizedUrl);

        if (!isSupportedMediaUrl(parsedUrl.toString())) {
            setMediaStatus("Unsupported site", "is-offline");
            addSystemMessage(`Only ${supportedSitesLabel()} links are supported for now.`);
            return null;
        }

        return parsedUrl.toString();
    } catch {
        setMediaStatus("Invalid link", "is-offline");
        return null;
    }
}

function openPlayerFromUrl(url) {
    if (!canControlPlayer()) {
        setMediaStatus("Ask host for control", "is-offline");
        return false;
    }

    if (!isSupportedMediaUrl(url)) {
        setMediaStatus("Unsupported site", "is-offline");
        return false;
    }

    selectedVideoUrl = url;
    driveFallbackAttemptedFor = "";
    driveConfirmAttemptedFor = "";
    mediaUrlInput.value = url;
    loadPlayerWebviewUrl(url);
    setMediaStatus("Loading", "");

    socket.emit("loadMedia", {
        room: roomCode,
        username,
        url,
        title: titleFromUrl(url)
    });

    return true;
}

async function getVideoMeta(url, titleHint = "") {
    const fallback = {
        title: titleHint || titleFromUrl(url),
        thumbnail: ""
    };

    const matchingWebview = [playerWebview, browserWebview].find(webview => {
        try {
            const currentUrl = webview.getURL?.() || webview.src || "";
            return currentUrl === url;
        } catch {
            return false;
        }
    });

    if (!matchingWebview) return fallback;

    try {
        const meta = await matchingWebview.executeJavaScript(`
            (() => {
                const bySelector = selector => document.querySelector(selector)?.content || "";
                const textBySelector = selector => document.querySelector(selector)?.textContent || "";
                const title =
                    bySelector('meta[property="og:title"]') ||
                    bySelector('meta[name="title"]') ||
                    document.title ||
                    "";
                const thumbnail =
                    bySelector('meta[property="og:image"]') ||
                    document.querySelector("video")?.poster ||
                    "";

                return { title, thumbnail };
            })()
        `);

        return {
            title: (meta?.title || fallback.title).slice(0, 140),
            thumbnail: meta?.thumbnail || ""
        };
    } catch {
        return fallback;
    }
}

async function hasActivePlayer() {
    const hasLoadedUrl = Boolean(
        selectedVideoUrl ||
        (playerWebview.src && playerWebview.src !== "about:blank" && isSupportedVideoUrl(playerWebview.src))
    );

    if (!hasLoadedUrl) return false;

    const state = await readPlaybackState();

    if (!state || state.ended) return false;

    return state.currentTime > 0.5 || state.paused === false;
}

function resetBrowserToHome() {
    clearTimeout(resetBrowserTimer);

    resetBrowserTimer = setTimeout(() => {
        const currentUrl = browserWebview.getURL?.() || browserWebview.src || "";

        if (currentUrl !== activeBrowserHome) {
            if (typeof browserWebview.loadURL === "function") {
                browserWebview.loadURL(activeBrowserHome);
            } else {
                browserWebview.src = activeBrowserHome;
            }
        }
    }, 120);
}

function setBrowserSite(site, options = {}) {
    restoreDriveBrowserToBrowserPane();

    const homes = {
        bilibili: BILIBILI_HOME,
        youtube: YOUTUBE_HOME,
        dailymotion: DAILYMOTION_HOME,
        facebook: FACEBOOK_HOME,
        drive: DRIVE_HOME
    };

    activeBrowserHome = homes[site] || BILIBILI_HOME;

    browseBilibiliButton.classList.toggle("is-active", activeBrowserHome === BILIBILI_HOME);
    browseYoutubeButton.classList.toggle("is-active", activeBrowserHome === YOUTUBE_HOME);
    browseDailymotionButton.classList.toggle("is-active", activeBrowserHome === DAILYMOTION_HOME);
    browseFacebookButton.classList.toggle("is-active", activeBrowserHome === FACEBOOK_HOME);
    browseDriveButton?.classList.toggle("is-active", activeBrowserHome === DRIVE_HOME);
    browserPane?.classList.toggle("is-drive-browser", activeBrowserHome === DRIVE_HOME);
    browserPane?.classList.remove("is-drive-video-page");
    if (driveLinkControls) {
        driveLinkControls.hidden = activeBrowserHome !== DRIVE_HOME;
    }

    if (options.load !== false) {
        if (activeBrowserHome === DRIVE_HOME) {
            if (typeof browserWebview.loadURL === "function") {
                browserWebview.loadURL(DRIVE_HOME);
            } else {
                browserWebview.src = DRIVE_HOME;
            }
            mediaUrlInput.value = driveLinkInput?.value.trim() || "";
            return;
        }

        if (typeof browserWebview.loadURL === "function") {
            browserWebview.loadURL(activeBrowserHome);
        } else {
            browserWebview.src = activeBrowserHome;
        }

        mediaUrlInput.value = activeBrowserHome;
    }
}

function getDriveLinkFromInput() {
    const rawUrl = driveLinkInput?.value.trim() || "";

    if (!rawUrl) {
        setMediaStatus("Paste a Drive link", "is-offline");
        driveLinkInput?.focus();
        return "";
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    try {
        const parsedUrl = new URL(normalizedUrl);

        if (!isGoogleDriveUrl(parsedUrl.toString())) {
            setMediaStatus("Use a Google Drive link", "is-offline");
            return "";
        }

        return parsedUrl.toString();
    } catch {
        setMediaStatus("Invalid Drive link", "is-offline");
        return "";
    }
}

function getCurrentBrowserUrl() {
    return browserWebview.getURL?.() || browserWebview.src || "";
}

function updateDriveBrowserCaptureState() {
    const isDriveVideoPage = activeBrowserHome === DRIVE_HOME && isGoogleDriveVideoUrl(getCurrentBrowserUrl());
    browserPane?.classList.toggle("is-drive-video-page", isDriveVideoPage);
}

async function getDriveBrowserMediaUrl() {
    if (activeBrowserHome !== DRIVE_HOME || !isGoogleDriveVideoUrl(getCurrentBrowserUrl())) return "";

    if (capturedDriveMediaUrl && Date.now() - capturedDriveMediaAt < 10 * 60 * 1000) {
        return capturedDriveMediaUrl;
    }

    try {
        const latest = await window.watchParty?.getDriveMediaUrl?.();
        if (latest?.url && isGoogleDriveDirectMediaUrl(latest.url)) {
            capturedDriveMediaUrl = latest.url;
            capturedDriveMediaAt = Date.now();
            return latest.url;
        }
    } catch {}

    try {
        const mediaUrl = await browserWebview.executeJavaScript(`
            (async () => {
                if (window.__watchPartyBrowserNoPlayback?.originalPlay) {
                    HTMLMediaElement.prototype.play = window.__watchPartyBrowserNoPlayback.originalPlay;
                    window.__watchPartyBrowserNoPlayback = null;
                }

                document.getElementById("watch-party-browser-clean")?.remove();
                window.__watchPartyMediaBlocker?.disconnect?.();

                const isUsefulMediaUrl = value => {
                    try {
                        const url = new URL(value, location.href);
                        const host = url.hostname.toLowerCase();
                        const path = url.pathname.toLowerCase();
                        return (
                            value &&
                            !value.startsWith("blob:") &&
                            (
                                host.includes("googleusercontent.com") ||
                                host.includes("googlevideo.com") ||
                                host.includes("usercontent.google.com") ||
                                path.includes("videoplayback") ||
                                path.includes("/download")
                            )
                        );
                    } catch {
                        return false;
                    }
                };

                const findUrl = () => {
                    const video = document.querySelector("video");
                    const videoUrl =
                        video?.currentSrc ||
                        video?.src ||
                        document.querySelector("video source[src]")?.src ||
                        "";

                    if (isUsefulMediaUrl(videoUrl)) return videoUrl;

                    const resources = performance.getEntriesByType("resource")
                        .map(entry => entry.name)
                        .filter(isUsefulMediaUrl);

                    return resources.find(url => /videoplayback|googlevideo|googleusercontent|usercontent\\.google/i.test(url)) ||
                        resources[0] ||
                        "";
                };

                let found = findUrl();

                if (found) return found;

                const video = document.querySelector("video");
                if (video) {
                    video.muted = true;
                    await video.play().catch(() => {});
                    await new Promise(resolve => setTimeout(resolve, 450));
                    video.pause?.();
                }

                return findUrl();
            })()
        `);

        if (typeof mediaUrl === "string" && mediaUrl) {
            capturedDriveMediaUrl = mediaUrl;
            capturedDriveMediaAt = Date.now();
            return mediaUrl;
        }

        return "";
    } catch {
        return "";
    }
}

function getCurrentBrowserVideoUrl() {
    const candidates = [
        getCurrentBrowserUrl(),
        driveLinkInput?.value.trim() || "",
        mediaUrlInput.value.trim()
    ];

    for (const rawUrl of candidates) {
        if (!rawUrl) continue;

        const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

        try {
            const parsedUrl = new URL(normalizedUrl);
            const url = parsedUrl.toString();

            if (isSupportedVideoUrl(url)) return url;
        } catch {}
    }

    return "";
}

async function addQueueFromUrl(url, titleHint = "") {
    if (!isSupportedVideoUrl(url)) {
        setMediaStatus("Select video first", "is-offline");
        return false;
    }

    const meta = await getVideoMeta(url, titleHint);
    const optimisticItem = {
        id: `pending-${Date.now()}`,
        url,
        title: meta.title,
        thumbnail: meta.thumbnail,
        addedBy: username,
        pending: true
    };

    // Refresh the queue section immediately while waiting for the server update.
    renderQueue([...queueItems, optimisticItem], { animate: true });

    socket.emit("addQueue", {
        room: roomCode,
        username,
        url,
        title: meta.title,
        thumbnail: meta.thumbnail
    });

    selectedVideoUrl = url;
    mediaUrlInput.value = url;
    setMediaStatus("Queued", "is-online");
    return true;
}

function askQueueConfirmation() {
    return new Promise(resolve => {
        document.getElementById("queueConfirmOverlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "queueConfirmOverlay";
        overlay.className = "queue-confirm-overlay";
        overlay.innerHTML = `
            <div class="queue-confirm-card" role="dialog" aria-modal="true" aria-labelledby="queueConfirmTitle">
                <div class="queue-confirm-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </div>
                <h3 id="queueConfirmTitle">Add video to queue?</h3>
                <p>A video is already playing. This selection will be added after the current video.</p>
                <div class="queue-confirm-actions">
                    <button type="button" class="ghost-button" data-action="cancel">Cancel</button>
                    <button type="button" class="primary-button" data-action="confirm">Add to queue</button>
                </div>
            </div>
        `;

        const finish = result => {
            overlay.remove();
            browserVideoPromptOpen = false;

            requestAnimationFrame(() => {
                window.watchParty?.setChatFocused?.(true);
                playerWebview.blur?.();
                browserWebview.blur?.();
                messageInput.disabled = false;
                messageInput.readOnly = false;
                messageInput.focus({ preventScroll: true });
            });

            resolve(result);
        };

        overlay.addEventListener("click", event => {
            if (event.target === overlay || event.target.closest('[data-action="cancel"]')) {
                finish(false);
                return;
            }

            if (event.target.closest('[data-action="confirm"]')) {
                finish(true);
            }
        });

        overlay.addEventListener("keydown", event => {
            if (event.key === "Escape") finish(false);
            if (event.key === "Enter") finish(true);
        });

        document.body.appendChild(overlay);
        overlay.querySelector('[data-action="confirm"]')?.focus();
    });
}

async function handleBrowserVideoSelection(url, titleHint = "") {
    if (!isSupportedVideoUrl(url)) return false;

    let playerUrl = url;

    if (activeBrowserHome === DRIVE_HOME && isGoogleDriveVideoUrl(url)) {
        setMediaStatus("Using Drive browser", "");
    }

    const now = Date.now();
    const identity = normalizedVideoIdentity(playerUrl);

    if (!identity) return false;

    if (
        browserVideoPromptOpen ||
        handlingBrowserVideoUrl === identity ||
        (lastPromptVideoIdentity === identity && now - lastPromptAt < 10000)
    ) {
        return true;
    }

    handlingBrowserVideoUrl = identity;
    lastPromptVideoIdentity = identity;
    lastPromptAt = now;

    try {
        if (!(await hasActivePlayer())) {
            if (!canControlPlayer()) {
                await addQueueFromUrl(url, titleHint);
                return true;
            }

            selectedVideoUrl = playerUrl;
            mediaUrlInput.value = playerUrl;
            loadPlayerWebviewUrl(playerUrl);
            setMediaStatus("Loading", "");

            socket.emit("loadMedia", {
                room: roomCode,
                username,
                url: playerUrl,
                title: titleHint || titleFromUrl(url)
            });

            requestAnimationFrame(() => {
                playerWebview.blur?.();
                browserWebview.blur?.();
                messageInput.focus({ preventScroll: true });
            });

            return true;
        }

        browserVideoPromptOpen = true;
        const shouldQueue = await askQueueConfirmation();

        if (shouldQueue) {
            await addQueueFromUrl(playerUrl, titleHint);
        } else {
            setMediaStatus("Not queued", "");
        }

        requestAnimationFrame(() => {
            playerWebview.blur?.();
            browserWebview.blur?.();
            window.watchParty?.setChatFocused?.(true);
            messageInput.disabled = false;
            messageInput.readOnly = false;
            messageInput.focus({ preventScroll: true });
        });

        return true;
    } finally {
        browserVideoPromptOpen = false;

        setTimeout(() => {
            if (handlingBrowserVideoUrl === identity) {
                handlingBrowserVideoUrl = "";
            }
        }, 2000);
    }
}

async function keepLinksInside(webview, targetMode = "self") {
    try {
        await webview.executeJavaScript(`
            (() => {
                const targetMode = ${JSON.stringify(targetMode)};

                const isVideoUrl = url => {
                    try {
                        const parsed = new URL(url, window.location.href);
                        const host = parsed.hostname.replace(/^www\\./, "").toLowerCase();
                        const path = parsed.pathname.toLowerCase();

                        const isBilibili =
                            host === "bilibili.com" ||
                            host.endsWith(".bilibili.com") ||
                            host === "bilibili.tv" ||
                            host.endsWith(".bilibili.tv") ||
                            host === "b23.tv" ||
                            host.endsWith(".b23.tv");
                        const isYoutube =
                            host === "youtube.com" ||
                            host.endsWith(".youtube.com") ||
                            host === "youtu.be" ||
                            host.endsWith(".youtu.be") ||
                            host === "youtube-nocookie.com" ||
                            host.endsWith(".youtube-nocookie.com");
                        const isDailymotion =
                            host === "dailymotion.com" ||
                            host.endsWith(".dailymotion.com") ||
                            host === "dai.ly" ||
                            host.endsWith(".dai.ly");
                        const isFacebook =
                            host === "facebook.com" ||
                            host.endsWith(".facebook.com") ||
                            host === "fb.watch" ||
                            host.endsWith(".fb.watch");
                        const isDrive =
                            host === "drive.google.com" ||
                            host.endsWith(".drive.google.com") ||
                            host === "docs.google.com" ||
                            host.endsWith(".docs.google.com");
                        return (
                            (isBilibili && (
                                path.includes("/video/") ||
                                path.includes("/bangumi/play/") ||
                                path.includes("/play/")
                            )) ||
                            (isYoutube && (
                                parsed.searchParams.has("v") ||
                                path.startsWith("/watch") ||
                                path.startsWith("/shorts/") ||
                                path.startsWith("/embed/") ||
                                path.startsWith("/live/") ||
                                host === "youtu.be"
                            )) ||
                            (isDailymotion && (
                                path.startsWith("/video/") ||
                                path.startsWith("/embed/video/") ||
                                path.includes("/player.html") ||
                                host === "dai.ly" ||
                                parsed.searchParams.has("video")
                            )) ||
                            (isFacebook && (
                                parsed.searchParams.has("v") ||
                                (path.startsWith("/watch/") && path !== "/watch/") ||
                                path.startsWith("/reel/") ||
                                path.includes("/videos/") ||
                                path.includes("/share/v/") ||
                                host === "fb.watch"
                            )) ||
                            (isDrive && (
                                parsed.searchParams.has("id") ||
                                path.startsWith("/file/d/")
                            ))
                        );
                    } catch {
                        return false;
                    }
                };

                const cleanTitle = value =>
                    String(value || "")
                        .replace(/\s+/g, " ")
                        .replace(/\|\s*bilibili.*$/i, "")
                        .replace(/\s*-\s*youtube.*$/i, "")
                        .replace(/\s*-\s*dailymotion.*$/i, "")
                        .trim()
                        .slice(0, 140);

                const sendVideoUrl = (url, title = "") => {
                    try {
                        const absoluteUrl = new URL(url, window.location.href).href;
                        const now = Date.now();

                        if (
                            window.__watchPartyLastVideoUrl === absoluteUrl &&
                            now - (window.__watchPartyLastVideoAt || 0) < 1200
                        ) {
                            return;
                        }

                        window.__watchPartyLastVideoUrl = absoluteUrl;
                        window.__watchPartyLastVideoAt = now;

                        const payload = JSON.stringify({
                            url: absoluteUrl,
                            title: cleanTitle(title)
                        });

                        console.log("__WATCH_PARTY_VIDEO_SELECTED__" + payload);
                    } catch {}
                };

                const isYoutubePage = () => {
                    const host = window.location.hostname.replace(/^www\\./, "").toLowerCase();
                    return host === "youtube.com" || host.endsWith(".youtube.com");
                };

                const hideUnwantedYoutubeSections = () => {
                    if (!isYoutubePage()) return;

                    if (!document.getElementById("watch-party-youtube-browser-clean")) {
                        const style = document.createElement("style");
                        style.id = "watch-party-youtube-browser-clean";
                        style.textContent = \`
                            ytd-reel-shelf-renderer,
                            ytd-reel-video-renderer,
                            ytd-shorts,
                            ytd-rich-section-renderer,
                            ytd-guide-entry-renderer:has(a[href*="/shorts"]),
                            ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
                            a[href^="/shorts"],
                            a[href*="/shorts/"],
                            a[title="Shorts"],
                            a[aria-label="Shorts"] {
                                display: none !important;
                                visibility: hidden !important;
                            }
                        \`;
                        document.documentElement.appendChild(style);
                    }

                    document.querySelectorAll('a[href^="/shorts"], a[href*="/shorts/"]').forEach(link => {
                        const container = link.closest([
                            "ytd-rich-grid-media",
                            "ytd-video-renderer",
                            "ytd-grid-video-renderer",
                            "ytd-compact-video-renderer",
                            "ytd-rich-item-renderer",
                            "ytd-reel-item-renderer",
                            "ytd-shelf-renderer",
                            "ytd-rich-section-renderer",
                            "yt-lockup-view-model",
                            "ytm-shorts-lockup-view-model",
                            "ytm-rich-item-renderer",
                            "ytd-guide-entry-renderer",
                            "ytd-mini-guide-entry-renderer",
                            "tp-yt-paper-item"
                        ].join(","));

                        (container || link).style.setProperty("display", "none", "important");
                    });
                };

                const normalizeLinks = () => {
                    document.querySelectorAll("a[href]").forEach(link => {
                        const absoluteUrl = new URL(link.href, window.location.href).href;

                        if (targetMode === "blank" && isVideoUrl(absoluteUrl)) {
                            link.target = "_blank";
                            link.rel = "noopener noreferrer";
                        }
                    });

                    hideUnwantedYoutubeSections();
                };

                normalizeLinks();

                if (!window.__watchPartyStableInterceptor && targetMode === "blank") {
                    window.__watchPartyStableInterceptor = true;

                    const originalPushState = history.pushState.bind(history);
                    const originalReplaceState = history.replaceState.bind(history);
                    const originalOpen = window.open.bind(window);

                    history.pushState = (state, title, url) => {
                        if (url) {
                            const absoluteUrl = new URL(url, window.location.href).href;

                            if (isVideoUrl(absoluteUrl)) {
                                sendVideoUrl(absoluteUrl);
                                return;
                            }
                        }

                        return originalPushState(state, title, url);
                    };

                    history.replaceState = (state, title, url) => {
                        if (url) {
                            const absoluteUrl = new URL(url, window.location.href).href;

                            if (isVideoUrl(absoluteUrl)) {
                                sendVideoUrl(absoluteUrl);
                                return;
                            }
                        }

                        return originalReplaceState(state, title, url);
                    };

                    window.open = (url, target, features) => {
                        const absoluteUrl = new URL(url || "", window.location.href).href;

                        if (isVideoUrl(absoluteUrl)) {
                            sendVideoUrl(absoluteUrl);
                            return null;
                        }

                        return originalOpen(url, target, features);
                    };

                    const resolveVideoTitle = (event, link) => {
                        const path = event.composedPath?.() || [];
                        const card = path.find(node =>
                            node?.matches?.(
                                "article, li, section, [class*='card'], [class*='video'], [class*='item'], [class*='feed']"
                            )
                        );

                        const image =
                            link?.querySelector?.("img") ||
                            card?.querySelector?.("img");

                        const titleNode =
                            card?.querySelector?.(
                                "[data-title], [title], h1, h2, h3, h4, h5, [class*='title'], [class*='name']"
                            ) ||
                            link?.querySelector?.(
                                "[data-title], [title], h1, h2, h3, h4, h5, [class*='title'], [class*='name']"
                            );

                        const candidates = [
                            link?.getAttribute?.("data-title"),
                            link?.getAttribute?.("title"),
                            link?.getAttribute?.("aria-label"),
                            titleNode?.getAttribute?.("data-title"),
                            titleNode?.getAttribute?.("title"),
                            titleNode?.textContent,
                            image?.getAttribute?.("alt"),
                            link?.textContent,
                            card?.textContent
                        ];

                        return candidates
                            .map(cleanTitle)
                            .find(value =>
                                value &&
                                value.length > 3 &&
                                !/^\d+[\d.,kmb]*\s*(views?|likes?)?$/i.test(value)
                            ) || "";
                    };

                    const resolveVideoUrl = event => {
                        const path = event.composedPath?.() || [];
                        const link = path.find(node => node?.matches?.("a[href]")) ||
                            event.target?.closest?.("a[href]");

                        if (link?.href) {
                            const absoluteUrl = new URL(link.href, window.location.href).href;
                            return isVideoUrl(absoluteUrl) ? absoluteUrl : "";
                        }

                        for (const node of path) {
                            if (
                                !node?.querySelector ||
                                node === document ||
                                node === document.documentElement ||
                                node === document.body ||
                                node === window
                            ) {
                                continue;
                            }

                            if (!node.matches?.(
                                "ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-playlist-video-renderer, article, li, section, [class*='card'], [class*='video'], [class*='item']"
                            )) {
                                continue;
                            }

                            const nestedLink = node?.querySelector?.(
                                "a[href*='/watch'], a[href*='/shorts/'], a[href*='/live/'], a[href*='/embed/']"
                            );

                            if (nestedLink?.href) {
                                const absoluteUrl = new URL(nestedLink.href, window.location.href).href;
                                if (isVideoUrl(absoluteUrl)) return absoluteUrl;
                            }
                        }

                        for (const node of path) {
                            const raw =
                                node?.getAttribute?.("data-href") ||
                                node?.getAttribute?.("data-url") ||
                                node?.dataset?.href ||
                                node?.dataset?.url;

                            if (!raw) continue;

                            const absoluteUrl = new URL(raw, window.location.href).href;
                            if (isVideoUrl(absoluteUrl)) return absoluteUrl;
                        }

                        return "";
                    };

                    const intercept = event => {
                    const targetUrl = resolveVideoUrl(event);
                    if (!targetUrl) return;

                    const path = event.composedPath?.() || [];
                    const link = path.find(node => node?.matches?.("a[href]")) ||
                        event.target?.closest?.("a[href]");
                    const title = resolveVideoTitle(event, link);

                    if (event.cancelable) event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    sendVideoUrl(targetUrl, title);
                };

                    const interceptFocusedLink = event => {
                        if (event.key !== "Enter" && event.key !== " ") return;

                        const link = document.activeElement?.closest?.("a[href]");
                        if (!link?.href || !isVideoUrl(link.href)) return;

                        if (event.cancelable) event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        sendVideoUrl(link.href, link.getAttribute("title") || link.textContent || "");
                    };

                    document.addEventListener("pointerdown", intercept, true);
                    document.addEventListener("mousedown", intercept, true);
                    document.addEventListener("touchstart", intercept, true);
                    document.addEventListener("pointerup", intercept, true);
                    document.addEventListener("click", intercept, true);
                    document.addEventListener("auxclick", intercept, true);
                    document.addEventListener("keydown", interceptFocusedLink, true);
                }

                if (!window.__watchPartyLinkObserver) {
                    window.__watchPartyLinkObserver = new MutationObserver(normalizeLinks);
                    window.__watchPartyLinkObserver.observe(document.documentElement, {
                        childList: true,
                        subtree: true
                    });
                }

                return true;
            })()
        `);
    } catch {}
}

async function installDriveBrowserActions() {
    if (!isGoogleDriveVideoUrl(getCurrentBrowserUrl())) return;

    try {
        await browserWebview.executeJavaScript(`
            (() => {
                const currentUrl = location.href;
                const title = document.title || "Google Drive video";
                const emit = action => {
                    const payload = JSON.stringify({
                        url: currentUrl,
                        title,
                        action
                    });
                    console.log("__WATCH_PARTY_VIDEO_SELECTED__" + payload);
                };

                const interceptDriveVideoClick = event => {
                    if (event.target.closest?.("#watch-party-drive-actions, input, textarea, button, select, a[href], [role='button'][aria-label*='Share']")) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    emit("play");
                };

                let dock = document.getElementById("watch-party-drive-actions");

                if (!dock) {
                    dock = document.createElement("div");
                    dock.id = "watch-party-drive-actions";
                    dock.innerHTML = \`
                        <button type="button" data-action="play">Play in player</button>
                        <button type="button" data-action="queue">Queue</button>
                    \`;

                    const style = document.createElement("style");
                    style.id = "watch-party-drive-actions-style";
                    style.textContent = \`
                        #watch-party-drive-actions {
                            position: fixed;
                            right: 18px;
                            bottom: 18px;
                            z-index: 2147483647;
                            display: inline-flex;
                            gap: 8px;
                            padding: 8px;
                            border: 1px solid rgba(255,255,255,.18);
                            border-radius: 999px;
                            background: rgba(8,12,18,.78);
                            box-shadow: 0 14px 34px rgba(0,0,0,.32);
                            font-family: Inter, Arial, sans-serif;
                        }

                        #watch-party-drive-actions button {
                            min-height: 38px;
                            padding: 0 14px;
                            border: 0;
                            border-radius: 999px;
                            color: #07110f;
                            background: linear-gradient(135deg, #43c6ac, #f4b942);
                            font-weight: 900;
                            cursor: pointer;
                        }

                        #watch-party-drive-actions button[data-action="queue"] {
                            color: #fff;
                            border: 1px solid rgba(255,255,255,.14);
                            background: rgba(17,23,34,.92);
                        }
                    \`;

                    document.documentElement.appendChild(style);
                    document.documentElement.appendChild(dock);
                    dock.addEventListener("click", event => {
                        const button = event.target.closest("button[data-action]");
                        if (!button) return;

                        event.preventDefault();
                        event.stopPropagation();
                        emit(button.dataset.action || "play");
                    });
                }

                if (!window.__watchPartyDriveClickInterceptor) {
                    window.__watchPartyDriveClickInterceptor = true;
                    document.addEventListener("pointerdown", interceptDriveVideoClick, true);
                    document.addEventListener("mousedown", interceptDriveVideoClick, true);
                    document.addEventListener("touchstart", interceptDriveVideoClick, true);
                    document.addEventListener("click", interceptDriveVideoClick, true);
                }

                return true;
            })()
        `);
    } catch {}
}

function getQueueUrl() {
    const browserUrl = getCurrentBrowserVideoUrl();

    if (browserUrl && browserUrl !== activeBrowserHome) {
        return browserUrl;
    }

    const fieldUrl = getSupportedMediaUrl();

    if (fieldUrl && fieldUrl !== activeBrowserHome && isSupportedVideoUrl(fieldUrl)) {
        return fieldUrl;
    }

    if (selectedVideoUrl) {
        return selectedVideoUrl;
    }

    if (playerWebview.src && playerWebview.src !== "about:blank" && isSupportedVideoUrl(playerWebview.src)) {
        return playerWebview.src;
    }

    setMediaStatus("Select video first", "is-offline");
    return null;
}

async function disableBrowserPlayback() {
    try {
        await browserWebview.executeJavaScript(`
            (() => {
                const installBrowserCss = () => {
                    if (document.getElementById("watch-party-browser-clean")) return;

                    const style = document.createElement("style");
                    style.id = "watch-party-browser-clean";
                    style.textContent = \`
                        html,
                        body {
                            scrollbar-width: none !important;
                            -ms-overflow-style: none !important;
                        }

                        html::-webkit-scrollbar,
                        body::-webkit-scrollbar,
                        *::-webkit-scrollbar {
                            width: 0 !important;
                            height: 0 !important;
                            display: none !important;
                        }

                        video,
                        audio,
                        canvas,
                        iframe[src*="player"],
                        [class*="player"],
                        [class*="Player"],
                        [class*="video-player"],
                        [class*="VideoPlayer"] {
                            background: transparent !important;
                            opacity: 0 !important;
                            visibility: hidden !important;
                            pointer-events: none !important;
                        }

                        video,
                        audio {
                            opacity: 0 !important;
                            visibility: hidden !important;
                            pointer-events: none !important;
                        }
                    \`;
                    document.documentElement.appendChild(style);
                };

                const stopMedia = () => {
                    installBrowserCss();

                    document.querySelectorAll("video, audio").forEach(media => {
                        media.pause();
                        media.muted = true;
                        media.controls = false;
                        media.preload = "none";
                        media.removeAttribute("autoplay");
                    });
                };

                stopMedia();

                if (!window.__watchPartyBrowserNoPlayback) {
                    const originalPlay = HTMLMediaElement.prototype.play;

                    HTMLMediaElement.prototype.play = function blockedPlay() {
                        this.pause();
                        this.muted = true;
                        return Promise.resolve();
                    };

                    window.__watchPartyBrowserNoPlayback = {
                        originalPlay
                    };

                    window.__watchPartyMediaBlocker = new MutationObserver(stopMedia);
                    window.__watchPartyMediaBlocker.observe(document.documentElement, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["autoplay", "src"]
                    });

                    window.setInterval(stopMedia, 1000);
                }
            })()
        `);
    } catch {}
}

async function cleanPlayerView() {
    if (playerWebview.src === "about:blank") {
        setMediaStatus("Load player first", "is-offline");
        return false;
    }

    if (isDrivePlayerMode()) {
        setMediaStatus("Ready", "is-online");
        return true;
    }

    try {
        const cleaned = await playerWebview.executeJavaScript(`
            (() => {
                const isYoutubePage = /(^|\\.)youtube(?:-nocookie)?\\.com$/i.test(location.hostname) ||
                    /(^|\\.)youtu\\.be$/i.test(location.hostname);
                const css = \`
                    html,
                    body {
                        width: 100vw !important;
                        height: 100vh !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background: #151922 !important;
                    }

                    *,
                    *::before,
                    *::after {
                        box-sizing: border-box !important;
                    }

                    header,
                    nav,
                    footer,
                    aside,
                    [class*="header"],
                    [class*="Header"],
                    [class*="navbar"],
                    [class*="Navbar"],
                    [class*="sidebar"],
                    [class*="Sidebar"],
                    [class*="comment"],
                    [class*="Comment"],
                    [class*="recommend"],
                    [class*="Recommend"],
                    [class*="related"],
                    [class*="Related"],
                    [class*="footer"],
                    [class*="Footer"],
                    [class*="banner"],
                    [class*="Banner"],
                    [class*="ad-"],
                    [id*="ad-"] {
                        display: none !important;
                    }

                    iframe,
                    canvas,
                    [class*="player"],
                    [class*="Player"],
                    [class*="video"],
                    [class*="Video"] {
                        width: 100vw !important;
                        height: 100vh !important;
                        max-width: none !important;
                        max-height: none !important;
                        background: #151922 !important;
                    }

                    video {
                        position: fixed !important;
                        inset: 0 !important;
                        display: block !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        max-width: none !important;
                        max-height: none !important;
                        object-fit: contain !important;
                        object-position: center center !important;
                        background: #151922 !important;
                        z-index: 2147483647 !important;
                    }
                \`;
                const youtubeCss = \`
                    html,
                    body,
                    ytd-app,
                    ytd-page-manager,
                    ytd-watch-flexy {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background: #151922 !important;
                    }

                    #columns,
                    #primary,
                    #primary-inner,
                    ytd-player,
                    #ytd-player,
                    #container.ytd-player,
                    #player,
                    #player-container,
                    #player-container-outer,
                    #player-theater-container,
                    #movie_player,
                    .html5-video-player,
                    .html5-video-container {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        max-width: none !important;
                        max-height: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #151922 !important;
                        overflow: hidden !important;
                        transform: none !important;
                    }

                    ytd-masthead,
                    #masthead-container,
                    #guide,
                    #guide-content,
                    tp-yt-app-drawer,
                    ytd-mini-guide-renderer,
                    #secondary,
                    #columns > #secondary,
                    #related,
                    #comments,
                    #chat,
                    #below,
                    #bottom-row,
                    #info,
                    #meta,
                    #meta-contents,
                    #description,
                    #ticket-shelf,
                    ytd-watch-metadata,
                    ytd-video-primary-info-renderer,
                    ytd-video-secondary-info-renderer,
                    ytd-merch-shelf-renderer,
                    ytd-rich-grid-renderer,
                    ytd-rich-section-renderer,
                    ytd-reel-shelf-renderer,
                    ytd-reel-video-renderer,
                    ytd-shorts,
                    a[href^="/shorts"],
                    a[href*="/shorts/"],
                    .ytp-ad-module,
                    .ytp-ad-overlay-container,
                    .ytp-paid-content-overlay,
                    .ytp-ad-player-overlay,
                    .ytp-ad-image-overlay,
                    .ytp-ad-text,
                    .ytp-ad-preview-container,
                    .ytp-ad-progress-list,
                    .video-ads,
                    #player-ads,
                    ytd-ad-slot-renderer,
                    ytd-companion-slot-renderer,
                    .ytp-ce-element {
                        display: none !important;
                    }

                    #player,
                    ytd-player,
                    #movie_player,
                    .html5-video-player,
                    .html5-video-container {
                        z-index: 2147483000 !important;
                    }

                    video,
                    video.video-stream,
                    .html5-main-video {
                        position: absolute !important;
                        inset: 0 !important;
                        display: block !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        max-width: none !important;
                        max-height: none !important;
                        object-fit: contain !important;
                        object-position: center center !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        filter: none !important;
                        transform: none !important;
                        background: #151922 !important;
                    }

                    .ytp-gradient-top,
                    .ytp-gradient-bottom,
                    .ytp-spinner,
                    .ytp-ad-image-overlay,
                    .ytp-ad-player-overlay {
                        opacity: 0 !important;
                        visibility: hidden !important;
                        pointer-events: none !important;
                        z-index: 1 !important;
                    }
                \`;

                const forceMediaFill = root => {
                    if (!root) return false;

                    if (isYoutubePage) return false;

                    const mediaItems = Array.from(root.querySelectorAll("video, canvas"));
                    if (mediaItems.length === 0) return false;

                    mediaItems.forEach(media => {
                        const styles = {
                            position: "fixed",
                            inset: "0",
                            width: "100vw",
                            height: "100vh",
                            display: "block",
                            "max-width": "none",
                            "max-height": "none",
                            "object-fit": "contain",
                            "object-position": "center center",
                            background: "#151922",
                            visibility: "visible",
                            opacity: "1",
                            transform: "none",
                            filter: "none",
                            "z-index": "2147483647"
                        };

                        Object.entries(styles).forEach(([property, value]) => {
                            media.style.setProperty(property, value, "important");
                        });
                    });

                    return true;
                };

                const cleanYoutubePlayer = () => {
                    if (!isYoutubePage) return false;

                    const sizedSelectors = [
                        "html",
                        "body",
                        "ytd-app",
                        "ytd-page-manager",
                        "ytd-watch-flexy",
                        "#columns",
                        "#primary",
                        "#primary-inner",
                        "ytd-player",
                        "#ytd-player",
                        "#container.ytd-player",
                        "#player",
                        "#player-container",
                        "#player-container-outer",
                        "#player-theater-container",
                        "#movie_player",
                        ".html5-video-player",
                        ".html5-video-container"
                    ];

                    sizedSelectors.forEach(selector => {
                        document.querySelectorAll(selector).forEach(element => {
                            element.style.setProperty("position", "fixed", "important");
                            element.style.setProperty("inset", "0", "important");
                            element.style.setProperty("width", "100vw", "important");
                            element.style.setProperty("height", "100vh", "important");
                            element.style.setProperty("max-width", "none", "important");
                            element.style.setProperty("max-height", "none", "important");
                            element.style.setProperty("margin", "0", "important");
                            element.style.setProperty("padding", "0", "important");
                            element.style.setProperty("background", "#151922", "important");
                            element.style.setProperty("overflow", "hidden", "important");
                            element.style.setProperty("transform", "none", "important");
                        });
                    });

                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    document.documentElement.style.setProperty("overflow", "hidden", "important");
                    document.documentElement.style.setProperty("position", "fixed", "important");
                    document.documentElement.style.setProperty("inset", "0", "important");
                    document.body.style.setProperty("overflow", "hidden", "important");
                    document.body.style.setProperty("position", "fixed", "important");
                    document.body.style.setProperty("inset", "0", "important");

                    document.querySelectorAll(
                        "ytd-masthead, #masthead-container, #guide, #guide-content, tp-yt-app-drawer, ytd-mini-guide-renderer, #secondary, #columns > #secondary, #related, #comments, #chat, #below, #bottom-row, #info, #meta, #meta-contents, #description, ytd-watch-metadata, ytd-video-primary-info-renderer, ytd-video-secondary-info-renderer, ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-reel-video-renderer, ytd-shorts, ytd-ad-slot-renderer, ytd-companion-slot-renderer, #player-ads, .video-ads, .ytp-ad-module, .ytp-ad-overlay-container, .ytp-paid-content-overlay, .ytp-ad-player-overlay, .ytp-ad-image-overlay, .ytp-ad-text, .ytp-ad-preview-container, .ytp-ad-progress-list, .ytp-ce-element"
                    ).forEach(element => {
                        element.style.setProperty("display", "none", "important");
                    });

                    document.querySelectorAll('a[href^="/shorts"], a[href*="/shorts/"]').forEach(link => {
                        const container = link.closest(
                            "ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-reel-item-renderer, ytd-shelf-renderer, ytd-rich-section-renderer"
                        );

                        (container || link).style.setProperty("display", "none", "important");
                    });

                    document.querySelectorAll(
                        ".ytp-gradient-top, .ytp-gradient-bottom, .ytp-spinner, .ytp-ad-image-overlay, .ytp-ad-player-overlay"
                    ).forEach(element => {
                        element.style.setProperty("opacity", "0", "important");
                        element.style.setProperty("visibility", "hidden", "important");
                        element.style.setProperty("pointer-events", "none", "important");
                        element.style.setProperty("z-index", "1", "important");
                    });

                    document.querySelectorAll("video").forEach(video => {
                        video.style.setProperty("position", "absolute", "important");
                        video.style.setProperty("inset", "0", "important");
                        video.style.setProperty("display", "block", "important");
                        video.style.setProperty("width", "100vw", "important");
                        video.style.setProperty("height", "100vh", "important");
                        video.style.setProperty("max-width", "none", "important");
                        video.style.setProperty("max-height", "none", "important");
                        video.style.setProperty("object-fit", "contain", "important");
                        video.style.setProperty("object-position", "center center", "important");
                        video.style.setProperty("visibility", "visible", "important");
                        video.style.setProperty("opacity", "1", "important");
                        video.style.setProperty("filter", "none", "important");
                        video.style.setProperty("transform", "none", "important");
                        video.style.setProperty("background", "#151922", "important");
                    });

                    const player = document.querySelector("#movie_player");
                    const isVisible = element => {
                        if (!element) return false;
                        const rect = element.getBoundingClientRect?.();
                        const style = getComputedStyle(element);
                        return Boolean(rect?.width && rect?.height) &&
                            style.display !== "none" &&
                            style.visibility !== "hidden" &&
                            Number(style.opacity || 1) > 0;
                    };
                    const visibleAdElement = Array.from(document.querySelectorAll(
                        ".ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-preview-container, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button"
                    )).some(isVisible);
                    const isShowingAd = Boolean(
                        player?.classList?.contains("ad-showing") ||
                        player?.classList?.contains("ad-interrupting") ||
                        visibleAdElement
                    );

                    if (isShowingAd) {
                        document.querySelectorAll(
                            ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button, .ytp-ad-skip-button-container button, button[class*='skip']"
                        ).forEach(button => button.click());

                        document.querySelectorAll("video").forEach(video => {
                            if (Number.isFinite(video.duration) && video.duration > 0) {
                                video.currentTime = Math.max(video.currentTime, video.duration - .1);
                            }
                            video.playbackRate = 16;
                            video.__watchPartyMutedForAd = true;
                            video.muted = true;
                        });
                    } else {
                        document.querySelectorAll("video").forEach(video => {
                            video.playbackRate = 1;
                            video.style.setProperty("opacity", "1", "important");
                            video.style.setProperty("visibility", "visible", "important");
                            if (video.__watchPartyMutedForAd) {
                                video.muted = false;
                                video.__watchPartyMutedForAd = false;
                            }
                        });
                    }

                    player?.classList?.remove("ad-showing", "ad-interrupting", "ad-created");

                    return Boolean(document.querySelector("video")) && !isShowingAd;
                };

                const applyCleanCss = root => {
                    if (!root || root.__watchPartyCleanPlayerApplied) return;

                    const style = root.createElement("style");
                    style.id = "watch-party-clean-player";
                    style.textContent = isYoutubePage ? youtubeCss : css;
                    root.documentElement.appendChild(style);
                    root.__watchPartyCleanPlayerApplied = true;
                };

                const forceAllMedia = () => {
                    if (isYoutubePage) {
                        return cleanYoutubePlayer();
                    }

                    let foundMedia = forceMediaFill(document);

                    for (const frame of document.querySelectorAll("iframe")) {
                        try {
                            applyCleanCss(frame.contentDocument);
                            foundMedia = forceMediaFill(frame.contentDocument) || foundMedia;
                        } catch {}
                    }

                    document.querySelectorAll("*").forEach(element => {
                        if (element.shadowRoot) {
                            foundMedia = forceMediaFill(element.shadowRoot) || foundMedia;
                        }
                    });

                    return foundMedia;
                };

                applyCleanCss(document);
                const foundMedia = forceAllMedia();

                window.__watchPartyForceMediaFill = forceAllMedia;

                if (!window.__watchPartyForceMediaObserver) {
                    window.__watchPartyForceMediaObserver = new MutationObserver(() => {
                        window.__watchPartyForceMediaFill?.();
                    });

                    window.__watchPartyForceMediaObserver.observe(document.documentElement, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["class", "src", "style"]
                    });

                    window.setInterval(() => window.__watchPartyForceMediaFill?.(), 350);
                }

                const video = document.querySelector("video");
                if (video) {
                    video.scrollIntoView({ block: "center", inline: "center" });
                    return true;
                }

                return foundMedia || Array.from(document.querySelectorAll("iframe")).some(frame => {
                    try {
                        return Boolean(frame.contentDocument?.querySelector("video"));
                    } catch {
                        return false;
                    }
                });
            })()
        `);

        setMediaStatus(cleaned ? "Clean player" : "Video still loading", cleaned ? "is-online" : "is-offline");
        return Boolean(cleaned);
    } catch {
        setMediaStatus("Clean unavailable", "is-offline");
        return false;
    }
}

function scheduleCleanPlayerView() {
    if (isDrivePlayerMode()) return;

    [80, 250, 600, 1200, 2400].forEach(delay => {
        setTimeout(() => {
            if (!isDrivePlayerMode()) {
                cleanPlayerView();
            }
        }, delay);
    });
}

function titleFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, "");
        if (isGoogleDriveUrl(url)) {
            return "Google Drive video";
        }

        const path = decodeURIComponent(parsedUrl.pathname)
            .split("/")
            .pop()
            ?.replace(/[-_]+/g, " ")
            .replace(/\.[a-z0-9]+$/i, "")
            .replace(/\s+/g, " ")
            .trim();

        return (path || `${host} video`).slice(0, 80);
    } catch {
        return "Video";
    }
}

function isHostUser() {
    return currentHost === username;
}

function canControlPlayer() {
    return isHostUser() || controllerUsers.has(username);
}

function shouldBroadcastPlaybackState() {
    return isHostUser();
}

function formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function clampVolume(value) {
    const volume = Number(value);
    if (!Number.isFinite(volume)) return 100;
    return Math.min(100, Math.max(0, Math.round(volume)));
}

function updateVolumeControl() {
    selectedVolume = clampVolume(selectedVolume);
    if (!volumeControlEl) return;

    volumeControlEl.value = String(selectedVolume);
    volumeControlEl.style.setProperty("--volume", `${selectedVolume}%`);
    volumeControlEl.title = `Volume ${selectedVolume}%`;
}

async function applyPlayerVolume(volume = selectedVolume) {
    selectedVolume = clampVolume(volume);
    updateVolumeControl();
    localStorage.setItem("watchPartyVolume", String(selectedVolume));

    if (!playerWebview || playerWebview.src === "about:blank") return false;

    try {
        return await playerWebview.executeJavaScript(`
            (() => {
                const volume = ${JSON.stringify(selectedVolume)};
                const normalizedVolume = Math.max(0, Math.min(1, volume / 100));

                if (window.watchPartyPlayer?.setVolume) {
                    window.watchPartyPlayer.setVolume(volume);
                    return true;
                }

                const applyToMedia = root => {
                    let applied = false;

                    root.querySelectorAll?.("video, audio")?.forEach(media => {
                        media.volume = normalizedVolume;
                        media.muted = volume <= 0;
                        applied = true;
                    });

                    root.querySelectorAll?.("iframe")?.forEach(frame => {
                        try {
                            applied = applyToMedia(frame.contentDocument) || applied;
                        } catch {}
                    });

                    return applied;
                };

                const player = document.querySelector("#movie_player");
                player?.setVolume?.(volume);
                if (volume > 0) player?.unMute?.();
                if (volume <= 0) player?.mute?.();

                return applyToMedia(document) || Boolean(player?.setVolume);
            })()
        `);
    } catch {
        return false;
    }
}

function updatePlayPauseIcon(paused = true) {
    const isPaused = Boolean(paused);

    playPauseButton.title = isPaused ? "Play" : "Pause";
    playPauseButton.setAttribute("aria-label", isPaused ? "Play" : "Pause");
    playPauseButton.classList.toggle("is-playing", !isPaused);
}

function updatePlaybackTime(state) {
    const currentTime = Number(state?.currentTime) || 0;
    const duration = Number(state?.duration) || 0;
    const displayText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    const paused = state?.paused !== false;

    if (lastPlaybackDisplayText !== displayText) {
        lastPlaybackDisplayText = displayText;
        playbackTimeEl.textContent = displayText;
    }

    if (lastPlaybackPausedState !== paused) {
        lastPlaybackPausedState = paused;
        updatePlayPauseIcon(paused);
    }

    if (!isSeekingPlayback) {
        const progress = duration > 0 ? Math.round((currentTime / duration) * 1000) : 0;
        const progressValue = String(Math.min(1000, Math.max(0, progress)));

        if (lastPlaybackProgressValue !== progressValue) {
            lastPlaybackProgressValue = progressValue;
            playbackProgressEl.value = progressValue;
        }
    }

    const progressFill = `${playbackProgressEl.value / 10}%`;
    if (lastPlaybackProgressFill !== progressFill) {
        lastPlaybackProgressFill = progressFill;
        playbackProgressEl.style.setProperty("--progress", progressFill);
    }
}

async function applyPlayerQuality(quality, options = {}) {
    const requestedQuality = String(quality || "auto");

    if (playerWebview.src === "about:blank") {
        return false;
    }

    try {
        const result = await playerWebview.executeJavaScript(`
            (async () => {
                const requestedQuality = ${JSON.stringify(requestedQuality)};
                if (window.watchPartyPlayer?.setQuality) {
                    return {
                        ok: Boolean(window.watchPartyPlayer.setQuality(requestedQuality)),
                        label: requestedQuality
                    };
                }

                const qualityLabels = {
                    auto: ["auto", "automatic", "default"],
                    360: ["360", "360p"],
                    480: ["480", "480p"],
                    720: ["720", "720p", "hd"],
                    1080: ["1080", "1080p", "full hd", "fhd"]
                };
                const wantedLabels = qualityLabels[requestedQuality] || qualityLabels.auto;
                const selector = [
                    "button",
                    "[role='button']",
                    "[role='menuitem']",
                    "li",
                    "a",
                    "span",
                    "div"
                ].join(",");
                const isVisible = element => {
                    if (!element) return false;
                    const rect = element.getBoundingClientRect?.();
                    const styles = window.getComputedStyle(element);
                    return Boolean(
                        rect &&
                        rect.width > 0 &&
                        rect.height > 0 &&
                        styles.visibility !== "hidden" &&
                        styles.display !== "none"
                    );
                };
                const textOf = element => [
                    element.textContent,
                    element.getAttribute?.("aria-label"),
                    element.getAttribute?.("title"),
                    element.className
                ].filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
                const clickElement = element => {
                    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
                    element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
                    element.click();
                };
                document.querySelectorAll("video").forEach(video => {
                    video.style.setProperty("z-index", "1", "important");
                    video.style.setProperty("pointer-events", "none", "important");
                });
                const findElements = () => Array
                    .from(document.querySelectorAll(selector))
                    .filter(isVisible);
                const matchesQuality = element => {
                    const text = textOf(element);
                    return wantedLabels.some(label => text.includes(label));
                };
                const triggerWords = [
                    "quality",
                    "resolution",
                    "auto",
                    "360",
                    "480",
                    "720",
                    "1080",
                    "清晰",
                    "画质"
                ];
                const triggers = findElements().filter(element => {
                    const text = textOf(element);
                    return triggerWords.some(word => text.includes(word));
                });

                for (const trigger of triggers.slice(-8)) {
                    clickElement(trigger);
                    await new Promise(resolve => setTimeout(resolve, 260));

                    const option = findElements()
                        .filter(matchesQuality)
                        .sort((first, second) => {
                            const firstRect = first.getBoundingClientRect();
                            const secondRect = second.getBoundingClientRect();
                            return (firstRect.width * firstRect.height) - (secondRect.width * secondRect.height);
                        })[0];

                    if (option) {
                        clickElement(option);
                        return {
                            ok: true,
                            label: option.textContent?.trim() || requestedQuality
                        };
                    }
                }

                const directOption = findElements().find(matchesQuality);
                if (directOption) {
                    clickElement(directOption);
                    return {
                        ok: true,
                        label: directOption.textContent?.trim() || requestedQuality
                    };
                }

                return {
                    ok: false,
                    label: requestedQuality
                };
            })()
        `);

        if (result?.ok) {
            lastAppliedQuality = requestedQuality;
        }

        if (!options.silent) {
            setMediaStatus(
                result?.ok ? `Quality ${qualitySelectEl?.selectedOptions?.[0]?.textContent || requestedQuality}` : "Quality unavailable",
                result?.ok ? "is-online" : "is-offline"
            );
        }

        return Boolean(result?.ok);
    } catch {
        if (!options.silent) {
            setMediaStatus("Quality unavailable", "is-offline");
        }

        return false;
    }
}

function scheduleQualityApply() {
    [160, 900, 2400, 5000].forEach(delay => {
        setTimeout(() => {
            if (selectedQuality !== "auto" || canControlPlayer()) {
                applyPlayerQuality(selectedQuality, { silent: true });
            }
        }, delay);
    });
}

function updateHostControls() {
    const isHost = isHostUser();
    const canControl = canControlPlayer();

    hostBadgeEl.textContent = isHost
        ? "You are host"
        : canControl
            ? "You can control"
            : `Host: ${currentHost || "Waiting"}`;
    const hasMedia = playerWebview.src && playerWebview.src !== "about:blank";
    playPauseButton.disabled = !canControl || !hasMedia;
    stopPlayerButton.disabled = !canControl || !hasMedia;
    playbackProgressEl.disabled = !canControl || !hasMedia;
    qualitySelectEl.disabled = !canControl || !hasMedia;
}

async function readPlaybackState() {
    try {
        return await playerWebview.executeJavaScript(`
            (() => {
                if (window.watchPartyPlayer?.getState) {
                    const state = window.watchPartyPlayer.getState();
                    if (state?.ready || state?.duration > 0 || state?.currentTime > 0) {
                        return {
                            currentTime: Number(state.currentTime) || 0,
                            duration: Number(state.duration) || 0,
                            paused: state.paused !== false,
                            ended: Boolean(state.ended)
                        };
                    }
                }

                const findVideo = root => {
                    const directVideo = root.querySelector("video");
                    if (directVideo) return directVideo;

                    for (const frame of root.querySelectorAll("iframe")) {
                        try {
                            const nestedVideo = frame.contentDocument?.querySelector("video");
                            if (nestedVideo) return nestedVideo;
                        } catch {}
                    }

                    return null;
                };

                const isYoutubePage = /(^|\.)youtube(?:-nocookie)?\.com$/i.test(location.hostname) ||
                    /(^|\.)youtu\.be$/i.test(location.hostname);
                const player = document.querySelector("#movie_player");
                const isVisible = element => {
                    if (!element) return false;
                    const rect = element.getBoundingClientRect?.();
                    const style = getComputedStyle(element);
                    return Boolean(rect?.width && rect?.height) &&
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        Number(style.opacity || 1) > 0;
                };
                if (isYoutubePage) {
                    document.querySelectorAll(
                        ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button"
                    ).forEach(button => button.click());
                }

                const video = findVideo(document);

                if (video && (
                    Number(video.currentTime) > 0 ||
                    (Number.isFinite(video.duration) && video.duration > 0) ||
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
                    video.videoWidth > 0
                )) {
                    return {
                        currentTime: video.currentTime || 0,
                        duration: Number.isFinite(video.duration) ? video.duration : 0,
                        paused: video.paused,
                        ended: Boolean(video.ended || window.__watchPartyEnded)
                    };
                }

                if (isYoutubePage && player && typeof player.getPlayerState === "function") {
                    const playerState = player.getPlayerState();
                    const duration = Number(player.getDuration?.() || 0);
                    const currentTime = Number(player.getCurrentTime?.() || 0);

                    if (duration > 0 || currentTime > 0 || [0, 1, 2, 3].includes(playerState)) {
                        return {
                            currentTime,
                            duration: Number.isFinite(duration) ? duration : 0,
                            paused: playerState !== 1,
                            ended: playerState === 0 || Boolean(window.__watchPartyEnded)
                        };
                    }
                }

                if (!video) return null;

                return {
                    currentTime: video.currentTime || 0,
                    duration: Number.isFinite(video.duration) ? video.duration : 0,
                    paused: video.paused,
                    ended: Boolean(video.ended || window.__watchPartyEnded)
                };
            })()
        `);
    } catch {
        return null;
    }
}

async function setPlayerPaused(shouldPause) {
    if (playerWebview.src === "about:blank") return null;

    try {
        return await playerWebview.executeJavaScript(`
            (async () => {
                const shouldPause = ${JSON.stringify(Boolean(shouldPause))};

                if (window.watchPartyPlayer?.setPaused) {
                    return window.watchPartyPlayer.setPaused(shouldPause);
                }

                const findVideo = root => {
                    const directVideo = root.querySelector("video");
                    if (directVideo) return directVideo;

                    for (const frame of root.querySelectorAll("iframe")) {
                        try {
                            const nestedVideo = frame.contentDocument?.querySelector("video");
                            if (nestedVideo) return nestedVideo;
                        } catch {}
                    }

                    return null;
                };

                const player = document.querySelector("#movie_player");
                const video = findVideo(document);

                player?.classList?.remove("ad-showing", "ad-interrupting", "ad-created");

                if (shouldPause) {
                    player?.pauseVideo?.();
                    video?.pause?.();
                } else {
                    player?.unMute?.();
                    player?.setVolume?.(${JSON.stringify(selectedVolume)});

                    document.querySelectorAll(
                        ".ytp-large-play-button, .ytp-play-button, .ytp-preview-play-button, button[aria-label='Play'], button[title='Play']"
                    ).forEach(button => button.click());

                    player?.playVideo?.();

                    if (video) {
                        video.volume = ${JSON.stringify(selectedVolume)} / 100;
                        video.muted = ${JSON.stringify(selectedVolume)} <= 0;
                        video.playbackRate = 1;
                        await video.play().catch(() => {});
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 120));

                const duration = Number(player?.getDuration?.() || video?.duration || 0);
                const currentTime = Number(player?.getCurrentTime?.() || video?.currentTime || 0);
                const playerState = typeof player?.getPlayerState === "function"
                    ? player.getPlayerState()
                    : null;

                return {
                    currentTime: Number.isFinite(currentTime) ? currentTime : 0,
                    duration: Number.isFinite(duration) ? duration : 0,
                    paused: playerState === null ? Boolean(video?.paused) : playerState !== 1,
                    ended: playerState === 0 || Boolean(video?.ended || window.__watchPartyEnded)
                };
            })()
        `);
    } catch {
        return null;
    }
}

async function applyPlaybackState(state) {
    if (!state || state.updatedBy === username) return;

    applyingRemotePlayback = true;

    try {
        const liveTargetTime = getSyncedPlaybackTime(state);
        const shouldPause = Boolean(state.paused);

        const result = await playerWebview.executeJavaScript(`
            (async () => {
                if (window.watchPartyPlayer?.seekTo) {
                    const playerState = window.watchPartyPlayer.getState?.() || {};
                    const currentTime = Number(playerState.currentTime) || 0;
                    const targetTime = ${JSON.stringify(liveTargetTime)};
                    const shouldPause = ${JSON.stringify(shouldPause)};
                    const drift = Number.isFinite(targetTime)
                        ? Math.abs(currentTime - targetTime)
                        : 0;
                    const isPauseMatched = Boolean(playerState.paused) === shouldPause;

                    if (playerState.ready && drift <= 1.15 && isPauseMatched) {
                        return "in-sync";
                    }

                    if (playerState.ready && drift <= 1.15 && !isPauseMatched && window.watchPartyPlayer?.setPaused) {
                        await window.watchPartyPlayer.setPaused(shouldPause);
                        return "pause-only";
                    }

                    await window.watchPartyPlayer.seekTo(targetTime, !shouldPause);
                    return "seek";
                }

                const findVideo = root => {
                    const directVideo = root.querySelector("video");
                    if (directVideo) return directVideo;

                    for (const frame of root.querySelectorAll("iframe")) {
                        try {
                            const nestedVideo = frame.contentDocument?.querySelector("video");
                            if (nestedVideo) return nestedVideo;
                        } catch {}
                    }

                    return null;
                };

                const video = findVideo(document);
                if (!video) return false;

                const targetTime = ${JSON.stringify(liveTargetTime)};
                const shouldPause = ${JSON.stringify(shouldPause)};

                const drift = Number.isFinite(targetTime)
                    ? Math.abs(video.currentTime - targetTime)
                    : 0;

                const isPauseMatched = Boolean(video.paused) === shouldPause;

                if (drift <= 1.15 && isPauseMatched) {
                    return "in-sync";
                }

                if (Number.isFinite(targetTime) && drift > 1.15) {
                    video.currentTime = targetTime;
                }

                if (shouldPause && !video.paused) {
                    video.pause();
                }

                if (!shouldPause && video.paused) {
                    await video.play().catch(() => {});
                }

                return drift > 1.15 ? "seek" : "pause-only";
            })()
        `);
        if (result && result !== "in-sync") {
            await applyPlayerVolume(selectedVolume);
        }
    } finally {
        applyingRemotePlayback = false;
    }
}

async function emitHostPlaybackState(forcePaused = null) {
    if (!canControlPlayer()) return;

    if (playerWebview.src === "about:blank") {
        setMediaStatus("Load player first", "is-offline");
        return;
    }

    const state = await readPlaybackState();

    if (!state) {
        setMediaStatus("Video still loading", "is-offline");
        return;
    }

    socket.emit("mediaControl", {
        room: roomCode,
        currentTime: state.currentTime,
        duration: state.duration,
        paused: forcePaused === null ? state.paused : forcePaused,
        quality: selectedQuality
    });
}

function loadBilibili({ url, title, loadedBy, loadedAt }) {
    const nextUrl = String(url || "").trim();
    const nextToken = `${nextUrl}|${loadedAt || ""}`;
    const isDuplicateLoad =
        nextUrl &&
        nextToken === lastLoadedMediaToken &&
        nextUrl === selectedVideoUrl &&
        playerWebview.src !== "about:blank" &&
        !playerPane.classList.contains("is-empty");

    hideQueueCountdown();
    handlingPlaybackEnd = false;
    setPlayerEmptyState(false);
    syncPlayerWebviewSize();
    selectedVideoUrl = nextUrl;
    driveFallbackAttemptedFor = "";
    driveConfirmAttemptedFor = "";
    mediaUrlInput.value = nextUrl;

    if (!isDuplicateLoad) {
        lastLoadedMediaToken = nextToken;
        if (nextUrl !== lastPlayerReadyUrl) {
            lastPlayerReadyUrl = "";
        }
        loadPlayerWebviewUrl(nextUrl);
        waitForPlayerReady();
        setMediaStatus("Loading", "");
        lastAppliedQuality = "";
        [250, 900, 1800].forEach(delay => {
            setTimeout(() => applyPlayerVolume(selectedVolume), delay);
        });
        scheduleQualityApply();
    } else {
        setMediaStatus("Ready", "is-online");
    }

    updateHostControls();

    if (loadedBy && !isDuplicateLoad) {
        addSystemMessage(`${loadedBy} loaded ${title || "a video"}.`);
    }
}

function renderQueue(items, options = {}) {
    queueItems = Array.isArray(items) ? items : [];
    queueCountEl.textContent = queueItems.length;
    const previousQueueKeys = new Set(
        Array.from(queueListEl.querySelectorAll(".queue-item"))
            .map(item => item.dataset.queueKey)
            .filter(Boolean)
    );
    queueListEl.innerHTML = "";

    const queuePanel = queueListEl.closest(".queue-panel") || queueListEl.parentElement;

    if (options.animate && queuePanel) {
        queuePanel.classList.remove("queue-refreshed");
        void queuePanel.offsetWidth;
        queuePanel.classList.add("queue-refreshed");
    }

    if (queueItems.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-queue";
        empty.innerHTML = `
            <strong>Nothing queued</strong>
            <small>Select a video to add it here.</small>
        `;
        queueListEl.appendChild(empty);
        return;
    }

    queueItems.forEach((item, index) => {
        const queueItem = document.createElement("article");
        queueItem.className = "queue-item";
        queueItem.dataset.queueId = item.id || "";
        queueItem.dataset.queueKey = getQueueAnimationKey(item, index);
        queueItem.dataset.pending = item.pending ? "true" : "false";
        if (options.animate && !previousQueueKeys.has(queueItem.dataset.queueKey)) {
            queueItem.classList.add("queue-item-entering");
        }

        const order = document.createElement("span");
        order.className = "queue-order";
        order.textContent = String(index + 1).padStart(2, "0");

        const meta = document.createElement("div");
        meta.className = "queue-meta";

        const title = document.createElement("strong");
        const rawTitle = String(item.title || "").trim();
        const uglyUrlTitle =
            /^(?:[a-z]{2}\/)?(?:video|play)\//i.test(rawTitle) ||
            /^https?:\/\//i.test(rawTitle) ||
            /^[a-z]{2}\/video\//i.test(rawTitle);

        title.textContent = uglyUrlTitle
            ? titleFromUrl(item.url || "") || `Queued video ${index + 1}`
            : (rawTitle || `Queued video ${index + 1}`);
        title.title = title.textContent;

        const addedBy = document.createElement("span");
        addedBy.textContent = item.pending
            ? "Adding to queue…"
            : `Added by ${item.addedBy || "Guest"}`;

        meta.append(title, addedBy);

        const actions = document.createElement("div");
        actions.className = "queue-actions";
        const canRemoveQueueItem = canControlPlayer() || item.addedBy === username;

        const playButton = document.createElement("button");
        playButton.className = "queue-action queue-action-play";
        playButton.type = "button";
        playButton.innerHTML = `
            <svg class="queue-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.75v12.5c0 .82.9 1.32 1.58.87l9.1-6.25a1.05 1.05 0 0 0 0-1.74l-9.1-6.25A1.04 1.04 0 0 0 8 5.75Z" />
            </svg>
            <span>Play</span>
        `;
        playButton.disabled = Boolean(item.pending) || !canControlPlayer();
        playButton.onclick = () => {
            socket.emit("loadMedia", {
                room: roomCode,
                username,
                url: item.url,
                title: item.title
            });

            socket.emit("removeQueue", {
                room: roomCode,
                id: item.id
            });
        };

        const removeButton = document.createElement("button");
        removeButton.className = "queue-action queue-action-remove";
        removeButton.type = "button";
        removeButton.innerHTML = `
            <svg class="queue-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <span>Remove</span>
        `;
        removeButton.disabled = Boolean(item.pending) || !canRemoveQueueItem;
        removeButton.onclick = () => {
            socket.emit("removeQueue", {
                room: roomCode,
                id: item.id
            });
        };

        actions.append(playButton, removeButton);
        queueItem.append(order, meta, actions);
        queueListEl.appendChild(queueItem);
    });
}

function joinRoom() {
    if (!roomCode) {
        setRoomLoading(false);
        addSystemMessage("Missing room code.");
        return;
    }

    setRoomLoading(true, shouldCreateRoom ? "Creating room" : "Joining room", `Room ${roomCode}`);
    socket.emit("joinRoom", {
        room: roomCode,
        username,
        create: shouldCreateRoom
    });
}

socket.on("connect", () => {
    setConnection("Connected", "is-online");
    joinRoom();
});

socket.on("disconnect", () => {
    leaveMic(false);

    if (!roomHasJoined) {
        setRoomLoading(true, "Reconnecting", "Trying to reach the watch party server");
    }
    setConnection("Disconnected", "is-offline");
});

socket.on("roomError", message => {
    roomHasJoined = false;
    setRoomLoading(false);
    addSystemMessage(message);
    setConnection("Room unavailable", "is-offline");
});

socket.on("roomUsers", data => {
    roomHasJoined = true;
    setRoomLoading(false);
    messageInput.disabled = false;
    messageInput.readOnly = false;

    const users = Array.isArray(data) ? data : data.users;
    const host = data.host;
    currentHost = host;
    controllerUsers = new Set(Array.isArray(data.controllers) ? data.controllers : []);

    usersEl.innerHTML = "";
    guestCountEl.textContent = users.length;
    updateHostControls();

    users.forEach(user => {
        const item = document.createElement("div");
        item.className = "user";

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = user.slice(0, 1).toUpperCase();

        const name = document.createElement("span");
        name.textContent = user === username ? `${user} (you)` : user;

        const role = document.createElement("small");
        const isController = controllerUsers.has(user);
        role.textContent = user === host ? "Host" : isController ? "Controller" : "Guest";

        item.append(avatar, name, role);

        if (isHostUser() && user !== username && user !== host) {
            const controlButton = document.createElement("button");
            controlButton.type = "button";
            controlButton.className = "user-control-button";
            controlButton.textContent = isController ? "Revoke" : "Allow";
            controlButton.title = isController ? `Remove ${user}'s player control` : `Let ${user} control playback`;
            controlButton.addEventListener("click", () => {
                controlButton.disabled = true;
                controlButton.textContent = isController ? "Revoking" : "Allowing";

                let confirmed = false;
                const failTimer = setTimeout(() => {
                    if (confirmed) return;

                    controlButton.disabled = false;
                    controlButton.textContent = isController ? "Revoke" : "Allow";
                    addSystemMessage("Permission update was not confirmed. Restart the server if this keeps happening.");
                }, 2500);

                socket.emit("setController", {
                    room: roomCode,
                    target: user,
                    allowed: !isController
                }, response => {
                    confirmed = true;
                    clearTimeout(failTimer);

                    if (!response?.ok) {
                        controlButton.disabled = false;
                        controlButton.textContent = isController ? "Revoke" : "Allow";
                        addSystemMessage(response?.message || "Could not update control permission.");
                    }
                });
            });
            item.appendChild(controlButton);
        }

        usersEl.appendChild(item);
    });
});

socket.on("chat", addMessage);
socket.on("system", addSystemMessage);
socket.on("playerEffect", renderPlayerEffect);
socket.on("voiceUsers", updateVoiceUsers);
socket.on("voicePeerJoined", peer => {
    if (!isMicJoined || !peer?.id || peer.id === ownVoiceId) return;

    addSystemMessage(`${peer.username || "Guest"} joined mic.`);
});
socket.on("voicePeerLeft", peer => {
    if (peer?.id) {
        closeVoicePeer(peer.id);
    }

    if (peer?.username) {
        addSystemMessage(`${peer.username} left mic.`);
    }
});
socket.on("voicePeerMuted", peer => {
    if (peer?.muted && peer?.id) {
        speakingVoiceIds.delete(peer.id);
        refreshSpeakingIndicator();
    }

    if (peer?.username) {
        addSystemMessage(`${peer.username} ${peer.muted ? "muted" : "unmuted"} mic.`);
    }
});
socket.on("voiceSignal", async data => {
    if (!isMicJoined || !localMicStream || !data?.from || data.from === ownVoiceId) return;

    const connection = createVoicePeer(data.from, data.username);
    if (!connection) return;

    const signal = data.signal || {};

    try {
        if (signal.type === "offer") {
            await connection.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);

            socket.emit("voiceSignal", {
                room: roomCode,
                target: data.from,
                signal: connection.localDescription
            });
        } else if (signal.type === "answer") {
            await connection.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.type === "candidate" && signal.candidate) {
            await connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    } catch {
        closeVoicePeer(data.from);
    }
});
socket.on("mediaLoaded", loadBilibili);
socket.on("mediaStopped", async data => {
    hideQueueCountdown();

    if (document.fullscreenElement === playerStage) {
        await document.exitFullscreen().catch(() => {});
    }

    restoreDriveBrowserToBrowserPane();
    playerWebview.src = "about:blank";
    playerPane.classList.remove("is-drive-player");
    selectedVideoUrl = "";
    driveConfirmAttemptedFor = "";
    lastLoadedMediaToken = "";
    lastPlayerReadyUrl = "";
    lastPlaybackState = null;
    handlingPlaybackEnd = false;
    mediaUrlInput.value = activeBrowserHome;

    setPlayerEmptyState(true);
    setMediaStatus("Empty", "");
    updateHostControls();

    // Refresh only the chat input so stale Electron focus is discarded.
    refreshChatInput();

    if (data?.stoppedBy) {
        addSystemMessage(`${data.stoppedBy} stopped the video.`);
    }
});
socket.on("queueUpdated", items => {
    renderQueue(items, { animate: true });
});
socket.on("mediaPlayback", state => {
    const incomingQuality = String(state?.quality || selectedQuality || "auto");

    if (incomingQuality !== selectedQuality) {
        selectedQuality = incomingQuality;
        qualitySelectEl.value = incomingQuality;
    }

    lastPlaybackState = withLocalSyncState({
        ...state,
        updatedAt: Number(state?.updatedAt) || Date.now()
    });
    const displayState = getDisplayPlaybackState(lastPlaybackState);
    updatePlaybackTime(displayState);
    updateQueueCountdown(displayState);

    if (state?.updatedBy !== username && incomingQuality && incomingQuality !== lastAppliedQuality) {
        applyPlayerQuality(incomingQuality, { silent: true });
    }

    applyPlaybackState(state);
});

socket.on("typing", data => {
    const typingText = `${data.username} is typing...`;
    typingEl.textContent = typingText;
    if (fullscreenTypingEl) {
        fullscreenTypingEl.textContent = typingText;
        fullscreenTypingEl.hidden = false;
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        typingEl.textContent = "";
        if (fullscreenTypingEl) {
            fullscreenTypingEl.textContent = "";
            fullscreenTypingEl.hidden = true;
        }
    }, 1200);
});

function emitChatMessage(input, shouldFocus = true) {
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    socket.emit("chat", {
        room: roomCode,
        username,
        message
    });

    input.value = "";

    if (input !== messageInput) {
        messageInput.value = "";
    }

    if (fullscreenMessageInput && input !== fullscreenMessageInput) {
        fullscreenMessageInput.value = "";
    }

    if (shouldFocus) {
        input.focus({ preventScroll: true });
    }
}

document.getElementById("send").onclick = () => {
    emitChatMessage(messageInput);
};

fullscreenSendEl?.addEventListener("submit", event => {
    event.preventDefault();
    emitChatMessage(fullscreenMessageInput);
});

function applyForwardedChatKey(input) {
    if (!input || input.type !== "keyDown") return;

    const key = input.key || "";
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    const value = messageInput.value;

    if ((input.control || input.meta) && key.toLowerCase() === "a") {
        messageInput.setSelectionRange(0, value.length);
        return;
    }

    if ((input.control || input.meta) && key.toLowerCase() === "v") {
        navigator.clipboard.readText().then(text => {
            const clipped = String(text || "").slice(0, 500);
            messageInput.setRangeText(clipped, start, end, "end");
            messageInput.dispatchEvent(new Event("input", { bubbles: true }));
        }).catch(() => {});
        return;
    }

    if (key === "Backspace") {
        if (start !== end) {
            messageInput.setRangeText("", start, end, "end");
        } else if (start > 0) {
            messageInput.setRangeText("", start - 1, start, "end");
        }
    } else if (key === "Delete") {
        if (start !== end) {
            messageInput.setRangeText("", start, end, "end");
        } else {
            messageInput.setRangeText("", start, start + 1, "end");
        }
    } else if (key === "ArrowLeft") {
        const next = Math.max(0, start - 1);
        messageInput.setSelectionRange(next, next);
        return;
    } else if (key === "ArrowRight") {
        const next = Math.min(value.length, end + 1);
        messageInput.setSelectionRange(next, next);
        return;
    } else if (key === "Home") {
        messageInput.setSelectionRange(0, 0);
        return;
    } else if (key === "End") {
        messageInput.setSelectionRange(value.length, value.length);
        return;
    } else if (key === "Enter") {
        document.getElementById("send").click();
        return;
    } else if (key.length === 1 && !input.control && !input.meta && !input.alt) {
        if (messageInput.value.length >= 500 && start === end) return;
        messageInput.setRangeText(key, start, end, "end");
    } else {
        return;
    }

    messageInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function focusChatInput() {
    messageInput.disabled = false;
    messageInput.readOnly = false;

    window.watchParty?.setChatFocused?.(true);
    playerWebview.blur?.();
    browserWebview.blur?.();
    window.focus();

    requestAnimationFrame(() => {
        messageInput.focus({ preventScroll: true });
    });
}

function bindChatInput() {
    messageInput.disabled = false;
    messageInput.readOnly = false;

    messageInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("send").click();
        }
    });

    messageInput.addEventListener("pointerdown", event => {
        event.stopPropagation();
        focusChatInput();
    });

    messageInput.addEventListener("click", event => {
        event.stopPropagation();
        focusChatInput();
    });

    messageInput.addEventListener("focus", () => {
        window.watchParty?.setChatFocused?.(true);
        playerWebview.blur?.();
        browserWebview.blur?.();
    });

    messageInput.addEventListener("blur", () => {
        setTimeout(() => {
            if (document.activeElement !== messageInput) {
                window.watchParty?.setChatFocused?.(false);
            }
        }, 120);
    });

    messageInput.addEventListener("input", () => {
        socket.emit("typing", {
            room: roomCode,
            username
        });
    });
}

function focusFullscreenChatInput() {
    if (!fullscreenMessageInput) return;

    fullscreenMessageInput.disabled = false;
    fullscreenMessageInput.readOnly = false;

    window.watchParty?.setChatFocused?.(true);
    playerWebview.blur?.();
    browserWebview.blur?.();
    window.focus();

    requestAnimationFrame(() => {
        fullscreenMessageInput.focus({ preventScroll: true });
    });
}

function bindFullscreenChatInput() {
    if (!fullscreenMessageInput) return;

    fullscreenMessageInput.disabled = false;
    fullscreenMessageInput.readOnly = false;

    fullscreenMessageInput.addEventListener("pointerdown", event => {
        event.stopPropagation();
        focusFullscreenChatInput();
    });

    fullscreenMessageInput.addEventListener("click", event => {
        event.stopPropagation();
        focusFullscreenChatInput();
    });

    fullscreenMessageInput.addEventListener("focus", () => {
        window.watchParty?.setChatFocused?.(true);
        playerWebview.blur?.();
        browserWebview.blur?.();
    });

    fullscreenMessageInput.addEventListener("blur", () => {
        setTimeout(() => {
            if (document.activeElement !== fullscreenMessageInput && document.activeElement !== messageInput) {
                window.watchParty?.setChatFocused?.(false);
            }
        }, 120);
    });

    fullscreenMessageInput.addEventListener("input", () => {
        socket.emit("typing", {
            room: roomCode,
            username
        });
    });
}

function refreshChatInput() {
    const oldInput = messageInput;
    const replacement = oldInput.cloneNode(true);

    replacement.value = "";
    replacement.disabled = false;
    replacement.readOnly = false;

    oldInput.replaceWith(replacement);
    messageInput = replacement;

    bindChatInput();

    setTimeout(() => {
        window.watchParty?.setChatFocused?.(true);
        browserWebview.blur?.();
        playerWebview.blur?.();
        focusChatInput();
    }, 80);

    setTimeout(() => {
        if (document.activeElement !== messageInput) {
            window.watchParty?.setChatFocused?.(true);
            focusChatInput();
        }
    }, 260);
}

window.watchParty?.onChatKey?.(applyForwardedChatKey);
bindChatInput();
bindFullscreenChatInput();

messageInput.parentElement.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    focusChatInput();
});

fullscreenSendEl?.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    focusFullscreenChatInput();
});

function setFullscreenChatVisible(isVisible) {
    isFullscreenChatVisible = Boolean(isVisible);

    if (fullscreenChatToggleButton) {
        fullscreenChatToggleButton.classList.toggle("is-active", isFullscreenChatVisible);
        fullscreenChatToggleButton.setAttribute("aria-pressed", String(isFullscreenChatVisible));
        fullscreenChatToggleButton.title = isFullscreenChatVisible ? "Hide chat" : "Show chat";
        fullscreenChatToggleButton.setAttribute("aria-label", isFullscreenChatVisible ? "Hide chat" : "Show chat");
    }

    if (fullscreenChatEl) {
        fullscreenChatEl.hidden = document.fullscreenElement !== playerStage || !isFullscreenChatVisible;
    }

    if (!isFullscreenChatVisible && document.activeElement === fullscreenMessageInput) {
        fullscreenMessageInput.blur();
        window.watchParty?.setChatFocused?.(false);
    }
}

fullscreenChatToggleButton?.addEventListener("click", () => {
    setFullscreenChatVisible(!isFullscreenChatVisible);
});

compactChatToggleButton?.addEventListener("click", () => {
    setCompactChatOpen(document.body.classList.contains("compact-chat-hidden"));
});

compactChatCloseButton?.addEventListener("click", () => {
    setCompactChatOpen(false);
});

compactBrowserToggleButton?.addEventListener("click", () => {
    compactBrowserTouched = true;
    const shouldOpen = document.body.classList.contains("compact-browser-hidden");
    setCompactBrowserOpen(shouldOpen);

    if (shouldOpen) {
        requestAnimationFrame(() => {
            browserPane?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }
});

compactChatResizeButton?.addEventListener("pointerdown", event => {
    if (!isCompactLayout() || document.body.classList.contains("compact-chat-hidden")) return;

    event.preventDefault();
    compactChatResizeButton.setPointerCapture?.(event.pointerId);
    const currentHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--compact-chat-height"));
    compactChatResizeState = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: Number.isFinite(currentHeight) ? currentHeight : 270
    };
    document.body.classList.add("is-resizing-compact-chat");
});

compactChatResizeButton?.addEventListener("pointermove", event => {
    if (!compactChatResizeState || compactChatResizeState.pointerId !== event.pointerId) return;

    const deltaY = compactChatResizeState.startY - event.clientY;
    setCompactChatHeight(compactChatResizeState.startHeight + deltaY, false);
});

function endCompactChatResize(pointerId) {
    if (!compactChatResizeState || compactChatResizeState.pointerId !== pointerId) return;

    const currentHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--compact-chat-height"));
    if (Number.isFinite(currentHeight)) {
        setCompactChatHeight(currentHeight, true);
    }
    compactChatResizeState = null;
    document.body.classList.remove("is-resizing-compact-chat");
}

compactChatResizeButton?.addEventListener("pointerup", event => {
    endCompactChatResize(event.pointerId);
});

compactChatResizeButton?.addEventListener("pointercancel", event => {
    endCompactChatResize(event.pointerId);
});

window.addEventListener("resize", syncCompactLayoutState);
syncCompactLayoutState();

function setFullscreenEffectTrayVisible(isVisible) {
    isFullscreenEffectTrayVisible = Boolean(isVisible);

    if (fullscreenEffectTrayEl) {
        fullscreenEffectTrayEl.hidden = !isFullscreenEffectTrayVisible;
    }

    if (fullscreenEffectToggleButton) {
        fullscreenEffectToggleButton.classList.toggle("is-active", isFullscreenEffectTrayVisible);
        fullscreenEffectToggleButton.setAttribute("aria-expanded", String(isFullscreenEffectTrayVisible));
        fullscreenEffectToggleButton.title = armedFullscreenEffect
            ? "Tap the video to throw"
            : isFullscreenEffectTrayVisible
                ? "Hide effects"
                : "Show effects";
    }
}

fullscreenEffectToggleButton?.addEventListener("click", () => {
    setFullscreenEffectTrayVisible(!isFullscreenEffectTrayVisible);
});

function setArmedFullscreenEffect(effectType = "") {
    armedFullscreenEffect = FULLSCREEN_EFFECT_TYPES.includes(effectType) ? effectType : "";
    fullscreenEffectsEl?.classList.toggle("is-armed", Boolean(armedFullscreenEffect));

    if (fullscreenEffectToggleButton) {
        fullscreenEffectToggleButton.classList.toggle("is-armed", Boolean(armedFullscreenEffect));
        if (armedFullscreenEffect) {
            fullscreenEffectToggleButton.title = "Tap the video to throw";
        } else if (!isFullscreenEffectTrayVisible) {
            fullscreenEffectToggleButton.title = "Show effects";
        }
    }

    fullscreenEffectButtons.forEach(button => {
        const isActive = button.dataset.effect === armedFullscreenEffect;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

fullscreenEffectButtons.forEach(button => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
        const nextEffect = button.dataset.effect === armedFullscreenEffect ? "" : button.dataset.effect;
        setArmedFullscreenEffect(nextEffect);
        setFullscreenEffectTrayVisible(false);
    });
});

function getPlayerEffectMarkup(effectType) {
    const premiumBurstSpans = `
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
    `;
    const debrisSpans = `
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
    `;

    if (effectType === "heart") {
        return `
            <span class="throw-effect-trail throw-effect-heart-trail" aria-hidden="true"></span>
            <span class="throw-effect-premium-sticker throw-effect-heart-sticker" aria-hidden="true">
                <img src="assets/effects/heart/heart-sticker.png" alt="">
            </span>
            <span class="throw-effect-impact-wave throw-effect-heart-wave" aria-hidden="true"></span>
            <span class="throw-effect-impact-wave throw-effect-heart-wave throw-effect-impact-wave-secondary" aria-hidden="true"></span>
            <span class="throw-effect-aftershock throw-effect-heart-aftershock" aria-hidden="true"></span>
            <span class="throw-effect-impact-flash throw-effect-heart-flash" aria-hidden="true"></span>
            <span class="throw-effect-sparkles throw-effect-heart-sparkles" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="throw-effect-premium-burst throw-effect-heart-burst" aria-hidden="true">
                ${premiumBurstSpans}
            </span>
            <span class="throw-effect-debris throw-effect-heart-debris" aria-hidden="true">
                ${debrisSpans}
            </span>
        `;
    }

    if (effectType === "cat") {
        return `
            <span class="throw-effect-trail throw-effect-cat-trail" aria-hidden="true"></span>
            <span class="throw-effect-premium-sticker throw-effect-cat-sticker" aria-hidden="true">
                <img src="assets/effects/cat/cat-sticker.png" alt="">
            </span>
            <span class="throw-effect-impact-wave throw-effect-cat-wave" aria-hidden="true"></span>
            <span class="throw-effect-impact-wave throw-effect-cat-wave throw-effect-impact-wave-secondary" aria-hidden="true"></span>
            <span class="throw-effect-aftershock throw-effect-cat-aftershock" aria-hidden="true"></span>
            <span class="throw-effect-impact-flash throw-effect-cat-flash" aria-hidden="true"></span>
            <span class="throw-effect-sparkles throw-effect-cat-sparkles" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="throw-effect-premium-burst throw-effect-cat-burst" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="throw-effect-debris throw-effect-cat-debris" aria-hidden="true">
                ${debrisSpans}
            </span>
        `;
    }

    if (effectType === "star") {
        return `
            <span class="throw-effect-trail throw-effect-star-trail" aria-hidden="true"></span>
            <span class="throw-effect-premium-sticker throw-effect-star-sticker" aria-hidden="true">
                <span class="throw-effect-star-shape"></span>
            </span>
            <span class="throw-effect-impact-wave throw-effect-star-wave" aria-hidden="true"></span>
            <span class="throw-effect-impact-wave throw-effect-star-wave throw-effect-impact-wave-secondary" aria-hidden="true"></span>
            <span class="throw-effect-aftershock throw-effect-star-aftershock" aria-hidden="true"></span>
            <span class="throw-effect-impact-flash throw-effect-star-flash" aria-hidden="true"></span>
            <span class="throw-effect-sparkles throw-effect-star-sparkles" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="throw-effect-premium-burst throw-effect-star-burst" aria-hidden="true">
                ${premiumBurstSpans}
            </span>
            <span class="throw-effect-debris throw-effect-star-debris" aria-hidden="true">
                ${debrisSpans}
            </span>
        `;
    }

    if (effectType === "bolt") {
        return `
            <span class="throw-effect-trail throw-effect-bolt-trail" aria-hidden="true"></span>
            <span class="throw-effect-premium-sticker throw-effect-bolt-sticker" aria-hidden="true">
                <span class="throw-effect-bolt-shape"></span>
            </span>
            <span class="throw-effect-impact-wave throw-effect-bolt-wave" aria-hidden="true"></span>
            <span class="throw-effect-impact-wave throw-effect-bolt-wave throw-effect-impact-wave-secondary" aria-hidden="true"></span>
            <span class="throw-effect-aftershock throw-effect-bolt-aftershock" aria-hidden="true"></span>
            <span class="throw-effect-impact-flash throw-effect-bolt-flash" aria-hidden="true"></span>
            <span class="throw-effect-sparkles throw-effect-bolt-sparkles" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="throw-effect-premium-burst throw-effect-bolt-burst" aria-hidden="true">
                ${premiumBurstSpans}
            </span>
            <span class="throw-effect-debris throw-effect-bolt-debris" aria-hidden="true">
                ${debrisSpans}
            </span>
        `;
    }

    return getPlayerEffectMarkup("heart");
}

function getFullscreenEffectLaunchPoint(effectType) {
    const activeEffectButton = fullscreenEffectButtons.find(button => button.dataset.effect === effectType);
    const toggleIcon = fullscreenEffectToggleButton?.querySelector?.(".fullscreen-fx-icon");
    const launchElement = fullscreenEffectToggleButton || activeEffectButton;
    const launchRect =
        toggleIcon?.getBoundingClientRect?.() ||
        launchElement?.getBoundingClientRect?.();

    if (!launchRect || launchRect.width <= 0 || launchRect.height <= 0) {
        return {
            x: window.innerWidth * 0.5,
            y: window.innerHeight * 0.88
        };
    }

    return {
        x: launchRect.left + launchRect.width / 2,
        y: launchRect.top + launchRect.height / 2
    };
}

function renderPlayerEffect(data = {}) {
    if (!fullscreenEffectsEl) return;

    const x = Math.min(0.97, Math.max(0.03, Number(data.x) || 0.5));
    const y = Math.min(0.94, Math.max(0.06, Number(data.y) || 0.5));
    const effectEl = document.createElement("div");
    const isMine = data.username === username;
    const effectType = FULLSCREEN_EFFECT_TYPES.includes(data.type) ? data.type : "heart";
    const targetX = x * window.innerWidth;
    const targetY = y * window.innerHeight;
    const launchPoint = getFullscreenEffectLaunchPoint(effectType);
    const fromX = (launchPoint.x - targetX).toFixed(1);
    const fromY = (launchPoint.y - targetY).toFixed(1);
    const midX = ((launchPoint.x - targetX) * 0.28).toFixed(1);
    const midY = ((launchPoint.y - targetY) * 0.28).toFixed(1);
    const impactTilt = ((Math.random() * 8) - 4).toFixed(1);

    effectEl.className = `throw-effect throw-effect-${effectType}${isMine ? " is-mine" : ""}`;
    effectEl.style.left = `${x * 100}%`;
    effectEl.style.top = `${y * 100}%`;
    effectEl.style.setProperty("--from-x", `${fromX}px`);
    effectEl.style.setProperty("--from-y", `${fromY}px`);
    effectEl.style.setProperty("--mid-x", `${midX}px`);
    effectEl.style.setProperty("--mid-y", `${midY}px`);
    effectEl.style.setProperty("--impact-tilt", `${impactTilt}deg`);
    effectEl.innerHTML = getPlayerEffectMarkup(effectType);
    playPremiumEffectSound(effectType);
    triggerPremiumEffectImpact();

    fullscreenEffectsEl.appendChild(effectEl);
    effectEl.addEventListener("animationend", event => {
        if (event.animationName === "throwEffectFade") {
            effectEl.remove();
        }
    });

    setTimeout(() => effectEl.remove(), 2700);
}

function sendPlayerEffectAt(event) {
    if (document.fullscreenElement !== playerStage || !fullscreenEffectsEl) return;
    if (!armedFullscreenEffect) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".player-controls, .fullscreen-chat, .fullscreen-chat-toggle, .player-fullscreen-button")) return;

    const now = Date.now();
    if (now - lastFullscreenEffectAt < 260) return;
    lastFullscreenEffectAt = now;

    const rect = fullscreenEffectsEl.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1);

    socket.emit("playerEffect", {
        room: roomCode,
        username,
        type: armedFullscreenEffect,
        x,
        y
    });
    setArmedFullscreenEffect("");
}

fullscreenEffectsEl?.addEventListener("pointerdown", sendPlayerEffectAt);

window.addEventListener("beforeunload", () => {
    window.watchParty?.clearChatFocus?.();
});


loadMediaButton.onclick = () => {
    const url = getCurrentBrowserVideoUrl() || getSupportedMediaUrl();

    if (!url) return;

    openPlayerFromUrl(url);
};

addToQueueButton.onclick = async () => {
    const url = getQueueUrl();

    if (!url) return;

    await addQueueFromUrl(url);

    browserWebview.blur?.();
    playerWebview.blur?.();
    window.watchParty?.setChatFocused?.(true);
    messageInput.disabled = false;
    messageInput.readOnly = false;
    messageInput.focus({ preventScroll: true });
};

mediaUrlInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        loadMediaButton.click();
    }
});

retryPlayerButton?.addEventListener("click", () => {
    if (!selectedVideoUrl) return;

    driveFallbackAttemptedFor = "";
    loadPlayerWebviewUrl(selectedVideoUrl);
    waitForPlayerReady();
    setMediaStatus("Retrying", "");
});

openPlayerExternalButton?.addEventListener("click", async () => {
    const url = selectedVideoUrl || playerWebview.src || "";
    if (!url) return;

    const result = await window.watchParty?.openExternal?.(url);
    if (!result?.ok) {
        setMediaStatus("Could not open link", "is-offline");
    }
});

continueDrivePlayerButton?.addEventListener("click", async () => {
    setDriveContinueVisible(false);
    setPlayerLoading(true, "Continuing Drive download");

    if (await continueDriveDownloadConfirmation()) {
        return;
    }

    try {
        const buttonRect = await playerWebview.executeJavaScript(`
            (() => {
                const candidates = Array.from(document.querySelectorAll("a, button, input[type='submit']"));
                const target = candidates.find(element =>
                    /download anyway/i.test(element.innerText || element.value || element.getAttribute("aria-label") || "")
                );
                if (!target) return null;

                const rect = target.getBoundingClientRect();
                return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
            })()
        `);

        if (buttonRect && Number.isFinite(buttonRect.x) && Number.isFinite(buttonRect.y)) {
            playerWebview.sendInputEvent?.({ type: "mouseMove", x: Math.round(buttonRect.x), y: Math.round(buttonRect.y) });
            playerWebview.sendInputEvent?.({ type: "mouseDown", x: Math.round(buttonRect.x), y: Math.round(buttonRect.y), button: "left", clickCount: 1 });
            playerWebview.sendInputEvent?.({ type: "mouseUp", x: Math.round(buttonRect.x), y: Math.round(buttonRect.y), button: "left", clickCount: 1 });
            driveConfirmAttemptedFor = selectedVideoUrl;
            setMediaStatus("Continuing Drive download", "");
            return;
        }
    } catch {}

    setPlayerError("Could not continue the Google Drive confirmation. Open the link directly or use a smaller/public video file.");
});

playerWebview.addEventListener("did-start-loading", () => {
    setMediaStatus("Loading", "");
    if (playerWebview.src !== "about:blank") {
        waitForPlayerReady();
    }
});

playerWebview.addEventListener("did-stop-loading", async () => {
    syncPlayerWebviewSize();

    if (isDrivePlayerMode()) {
        clearInterval(playerReadyCheckTimer);
        playerReadyCheckTimer = null;
        clearTimeout(playerLoadingReleaseTimer);
        playerLoadingReleaseTimer = null;
        setPlayerLoading(false);
        setMediaStatus("Drive ready", "is-online");
        keepLinksInside(playerWebview, "self");
        return;
    }

    if (isYoutubePlayerShellUrl(playerWebview.src)) {
        try {
            const shellFailed = await playerWebview.executeJavaScript(`
                document.body?.innerText?.includes("Cannot GET /youtube-player.html") ||
                document.body?.innerText?.includes("Cannot GET")
            `);

            if (shellFailed && loadYoutubeEmbedFallbackPlayer()) {
                return;
            }
        } catch {
            loadYoutubeEmbedFallbackPlayer();
            return;
        }
    }

    if (playerWebview.src !== "about:blank") {
        setMediaStatus("Preparing", "");
        waitForPlayerReady();
    }

    keepLinksInside(playerWebview, "self");
    scheduleQualityApply();
    scheduleCleanPlayerView();
    installPlayerEndGuard();

    clearTimeout(playerEndGuardTimer);
    playerEndGuardTimer = setTimeout(installPlayerEndGuard, 1200);

    if (lastPlaybackState) {
        applyPlaybackState(lastPlaybackState);
    }
});

playerWebview.addEventListener("did-fail-load", event => {
    const failedUrl = event?.validatedURL || event?.url || playerWebview.src || selectedVideoUrl || "";
    const isAbortedLoad = event?.errorCode === -3 || event?.errno === -3 || event?.code === "ERR_ABORTED";
    const driveFailure = isGoogleDriveUrl(failedUrl) || isGoogleDriveUrl(playerWebview.src || "") || isGoogleDriveUrl(selectedVideoUrl || "");

    if (isAbortedLoad && isIgnorableGoogleAssetUrl(failedUrl)) {
        return;
    }

    if (isAbortedLoad) {
        if (driveFailure) {
            setPlayerLoading(false);
            setMediaStatus("Drive preview", "is-online");
        }
        return;
    }

    if (driveFailure) {
        if (isGoogleDrivePreviewUrl(failedUrl)) {
            setPlayerLoading(false);
            setMediaStatus("Drive preview", "is-online");
            return;
        }

        setPlayerError(`Google Drive failed to load (${event?.errorDescription || event?.code || event?.errorCode || "unknown error"}).`);
        return;
    }

    if (isYoutubePlayerShellUrl(playerWebview.src) && loadYoutubeEmbedFallbackPlayer()) {
        return;
    }

    setPlayerError(event?.errorDescription || "The player could not load this video.");
});

playerWebview.addEventListener("will-navigate", event => {
    const targetUrl = event.url || "";

    if (isYoutubePlayerShellUrl(targetUrl)) {
        return;
    }

    if (targetUrl !== "about:blank" && !isSupportedMediaUrl(targetUrl)) {
        event.preventDefault();
        setMediaStatus("Unsupported site", "is-offline");
        return;
    }

    if (
        selectedVideoUrl &&
        isSupportedVideoUrl(targetUrl) &&
        !isSameVideoUrl(targetUrl, selectedVideoUrl)
    ) {
        event.preventDefault();
        handlePlaybackEnded();
        return;
    }

    mediaUrlInput.value = targetUrl;
});

playerWebview.addEventListener("new-window", event => {
    event.preventDefault();

    if (!event.url || !isSupportedMediaUrl(event.url)) return;

    if (
        selectedVideoUrl &&
        isSupportedVideoUrl(event.url) &&
        !isSameVideoUrl(event.url, selectedVideoUrl)
    ) {
        handlePlaybackEnded();
        return;
    }

    loadPlayerWebviewUrl(event.url);
    mediaUrlInput.value = event.url;
});

browserWebview.addEventListener("console-message", event => {
    const message = event.message || "";
    const prefix = "__WATCH_PARTY_VIDEO_SELECTED__";

    if (!message.startsWith(prefix)) return;

    const rawPayload = message.slice(prefix.length).trim();
    let selectedUrl = rawPayload;
    let selectedTitle = "";

    try {
        const payload = JSON.parse(rawPayload);
        selectedUrl = payload?.url || "";
        selectedTitle = payload?.title || "";
        if (payload?.action === "queue" && isSupportedVideoUrl(selectedUrl)) {
            addQueueFromUrl(selectedUrl, selectedTitle);
            return;
        }
        if (payload?.action === "play") {
            lastPromptVideoIdentity = "";
            handlingBrowserVideoUrl = "";
        }
    } catch {}

    if (isSupportedVideoUrl(selectedUrl)) {
        handleBrowserVideoSelection(selectedUrl, selectedTitle);
    }
});

browserPane?.addEventListener("click", event => {
    if (!browserPane.classList.contains("is-drive-video-page")) return;
    if (event.target.closest?.(".drive-link-controls, .browser-loading-state")) return;

    const url = getCurrentBrowserVideoUrl();
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    lastPromptVideoIdentity = "";
    handlingBrowserVideoUrl = "";
    handleBrowserVideoSelection(url, "Google Drive video");
});

browserWebview.addEventListener("did-start-loading", () => {
    browserPane?.classList.remove("is-drive-video-page");
    setBrowserLoading(true, activeBrowserHome === DRIVE_HOME ? "Loading Drive" : "Loading browser");

    if (playerWebview.src === "about:blank") {
        setMediaStatus("Browsing", "");
    }

    if (activeBrowserHome !== DRIVE_HOME) {
        disableBrowserPlayback();
    }
});

browserWebview.addEventListener("did-stop-loading", () => {
    if (activeBrowserHome === DRIVE_HOME) {
        setBrowserLoading(false);
        installDriveBrowserActions();
        updateDriveBrowserCaptureState();
        return;
    }

    setBrowserLoading(false);
    requestAnimationFrame(syncBrowserWebviewSize);
    keepLinksInside(browserWebview, "blank");
    disableBrowserPlayback();
});

browserWebview.addEventListener("did-fail-load", event => {
    const failedUrl = event?.validatedURL || event?.url || browserWebview.src || "";
    if (event?.errorCode === -3 || event?.errno === -3 || event?.code === "ERR_ABORTED") return;
    if (isIgnorableGoogleAssetUrl(failedUrl)) return;

    setBrowserLoading(false);
    setMediaStatus("Browser load failed", "is-offline");
});

browserWebview.addEventListener("did-navigate", event => {
    const targetUrl = event.url || browserWebview.getURL?.() || browserWebview.src || "";

    if (activeBrowserHome === DRIVE_HOME) {
        installDriveBrowserActions();
        updateDriveBrowserCaptureState();
        return;
    }

    if (isSupportedVideoUrl(targetUrl)) {
        handleBrowserVideoSelection(targetUrl);
    }
});

browserWebview.addEventListener("did-navigate-in-page", event => {
    const targetUrl = event.url || browserWebview.getURL?.() || browserWebview.src || "";

    if (activeBrowserHome === DRIVE_HOME) {
        installDriveBrowserActions();
        updateDriveBrowserCaptureState();
        return;
    }

    if (isSupportedVideoUrl(targetUrl)) {
        handleBrowserVideoSelection(targetUrl);
    }

    keepLinksInside(browserWebview, "blank");
    disableBrowserPlayback();
});

browserWebview.addEventListener("will-navigate", event => {
    const targetUrl = event.url || "";

    if (!isAllowedBrowserUrl(targetUrl)) {
        event.preventDefault();
        setMediaStatus("Unsupported site", "is-offline");
        return;
    }

    if (activeBrowserHome === DRIVE_HOME) {
        return;
    }

    if (isSupportedVideoUrl(targetUrl)) {
        event.preventDefault();
        handleBrowserVideoSelection(targetUrl);
    }
});

browserWebview.addEventListener("new-window", event => {
    event.preventDefault();

    if (!event.url) return;

    if (!isAllowedBrowserUrl(event.url)) {
        setMediaStatus("Unsupported site", "is-offline");
        return;
    }

    if (activeBrowserHome === DRIVE_HOME) {
        browserWebview.src = event.url;
        return;
    }

    if (isSupportedVideoUrl(event.url)) {
        handleBrowserVideoSelection(event.url);
        return;
    }

    browserWebview.src = event.url;
});

document.getElementById("copy").onclick = async () => {
    try {
        await navigator.clipboard.writeText(roomCode);
        addSystemMessage("Room code copied.");
    } catch {
        addSystemMessage(`Room code: ${roomCode}`);
    }
};

playPauseButton.onclick = async () => {
    if (!canControlPlayer()) return;

    const state = await readPlaybackState();

    if (!state && playerWebview.src === "about:blank") {
        setMediaStatus(playerWebview.src === "about:blank" ? "Load player first" : "Video still loading", "is-offline");
        return;
    }

    const nextPaused = state ? !state.paused : false;

    try {
        const nextState = await setPlayerPaused(nextPaused);

        if (!nextPaused && (!nextState || nextState.paused)) {
            try {
                const rect = playerWebview.getBoundingClientRect();
                playerWebview.sendInputEvent?.({ type: "mouseMove", x: Math.round(rect.width / 2), y: Math.round(rect.height / 2) });
                playerWebview.sendInputEvent?.({ type: "mouseDown", x: Math.round(rect.width / 2), y: Math.round(rect.height / 2), button: "left", clickCount: 1 });
                playerWebview.sendInputEvent?.({ type: "mouseUp", x: Math.round(rect.width / 2), y: Math.round(rect.height / 2), button: "left", clickCount: 1 });
            } catch {}
        }

        if (nextState) {
            lastPlaybackState = withLocalSyncState({
                ...nextState,
                paused: nextPaused,
                updatedAt: Date.now()
            });
            updatePlaybackTime(getDisplayPlaybackState(lastPlaybackState));
        }
        await applyPlayerVolume(selectedVolume);
    } finally {
        emitHostPlaybackState(nextPaused);
    }
};

stopPlayerButton.onclick = () => {
    if (!canControlPlayer() || playerWebview.src === "about:blank") return;

    socket.emit("stopMedia", {
        room: roomCode,
        username
    });
};

playbackProgressEl.addEventListener("pointerdown", () => {
    if (!canControlPlayer()) return;

    isSeekingPlayback = true;
    seekWasPlaying = lastPlaybackState
        ? !Boolean(lastPlaybackState.paused)
        : false;
});

playbackProgressEl.addEventListener("input", () => {
    if (!canControlPlayer()) return;

    isSeekingPlayback = true;
    const duration = Number(lastPlaybackState?.duration) || 0;
    const targetTime = duration * (Number(playbackProgressEl.value) / 1000);

    playbackTimeEl.textContent =
        `${formatTime(targetTime)} / ${formatTime(duration)}`;
    playbackProgressEl.style.setProperty(
        "--progress",
        `${playbackProgressEl.value / 10}%`
    );
});

async function commitPlaybackSeek() {
    if (!canControlPlayer() || seekCommitInProgress) return;

    seekCommitInProgress = true;

    try {
        const state = await readPlaybackState();
        const duration =
            Number(state?.duration) ||
            Number(lastPlaybackState?.duration) ||
            0;

        if (!Number.isFinite(duration) || duration <= 0) return;

        const targetTime = Math.max(
            0,
            Math.min(
                duration,
                duration * (Number(playbackProgressEl.value) / 1000)
            )
        );

        const shouldResume = state
            ? !Boolean(state.paused)
            : seekWasPlaying;

        const result = await playerWebview.executeJavaScript(`
            (async () => {
                if (window.watchPartyPlayer?.seekTo) {
                    return window.watchPartyPlayer.seekTo(
                        ${targetTime},
                        ${JSON.stringify(shouldResume)}
                    );
                }

                const findVideo = root => {
                    const directVideo = root.querySelector("video");
                    if (directVideo) return directVideo;

                    for (const frame of root.querySelectorAll("iframe")) {
                        try {
                            const nestedVideo =
                                frame.contentDocument?.querySelector("video");
                            if (nestedVideo) return nestedVideo;
                        } catch {}
                    }

                    return null;
                };

                const player = document.querySelector("#movie_player");
                const video = findVideo(document);
                if (!video && !player) return null;

                const target = ${targetTime};
                const resume = ${JSON.stringify(shouldResume)};

                if (typeof player?.seekTo === "function") {
                    player.seekTo(target, true);
                }

                if (video && Math.abs(video.currentTime - target) > 0.2) {
                    video.currentTime = target;
                }

                await new Promise(resolve => {
                    if (!video || video.readyState >= 2) {
                        resolve();
                        return;
                    }

                    const finish = () => resolve();

                    video.addEventListener("seeked", finish, { once: true });
                    video.addEventListener("canplay", finish, { once: true });
                    setTimeout(finish, 900);
                });

                if (resume) {
                    player?.playVideo?.();
                    if (video) await video.play().catch(() => {});
                } else {
                    player?.pauseVideo?.();
                    video?.pause?.();
                }

                const playerDuration = Number(player?.getDuration?.() || 0);
                const playerTime = Number(player?.getCurrentTime?.() || 0);
                const playerState = typeof player?.getPlayerState === "function"
                    ? player.getPlayerState()
                    : null;

                return {
                    currentTime: Number.isFinite(playerTime) && playerTime > 0 ? playerTime : video?.currentTime || target,
                    duration: Number.isFinite(playerDuration) && playerDuration > 0 ? playerDuration : video?.duration || 0,
                    paused: playerState === null ? Boolean(video?.paused) : playerState !== 1,
                    ended: playerState === 0 || Boolean(video?.ended)
                };
            })()
        `);

        if (result) {
            lastPlaybackState = withLocalSyncState({
                ...result,
                updatedAt: Date.now()
            });

            const displayState = getDisplayPlaybackState(lastPlaybackState);
            updatePlaybackTime(displayState);
            updateQueueCountdown(displayState);

            socket.emit("mediaControl", {
                room: roomCode,
                username,
                currentTime: result.currentTime,
                paused: result.paused,
                duration: result.duration,
                quality: selectedQuality,
                updatedAt: Date.now()
            });
            await applyPlayerVolume(selectedVolume);
        }
    } finally {
        isSeekingPlayback = false;
        seekCommitInProgress = false;
    }
}

playbackProgressEl.addEventListener("change", commitPlaybackSeek);

cleanPlayerButton.onclick = () => {
    cleanPlayerView();
};

volumeControlEl?.addEventListener("input", () => {
    selectedVolume = clampVolume(volumeControlEl.value);
    updateVolumeControl();
    applyPlayerVolume(selectedVolume);
});

updateVolumeControl();

qualitySelectEl.addEventListener("change", async () => {
    if (!canControlPlayer()) {
        qualitySelectEl.value = selectedQuality;
        return;
    }

    selectedQuality = qualitySelectEl.value || "auto";
    await applyPlayerQuality(selectedQuality);
    emitHostPlaybackState();
});

browserBackButton.onclick = () => {
    if (browserWebview.canGoBack?.()) {
        browserWebview.goBack();
        return;
    }

    browserWebview.loadURL(activeBrowserHome);
};

browserForwardButton.onclick = () => {
    if (browserWebview.canGoForward?.()) {
        browserWebview.goForward();
    }
};

browserReloadButton.onclick = () => {
    browserWebview.reload();
};

browseBilibiliButton.onclick = () => {
    setBrowserSite("bilibili");
};

browseYoutubeButton.onclick = () => {
    setBrowserSite("youtube");
};

browseDailymotionButton.onclick = () => {
    setBrowserSite("dailymotion");
};

browseFacebookButton.onclick = () => {
    setBrowserSite("facebook");
};

browseDriveButton.onclick = () => {
    setBrowserSite("drive");
};

openDriveLinkButton?.addEventListener("click", () => {
    const url = getDriveLinkFromInput();
    if (!url) return;

    mediaUrlInput.value = url;
    setBrowserSite("drive", { load: false });
    if (typeof browserWebview.loadURL === "function") {
        browserWebview.loadURL(url);
    } else {
        browserWebview.src = url;
    }
    setBrowserLoading(true, "Loading Drive video");
    setMediaStatus("Open the Drive video", "");
});

playDriveLinkButton?.addEventListener("click", () => {
    const url = getDriveLinkFromInput();
    if (!url) return;

    lastPromptVideoIdentity = "";
    handlingBrowserVideoUrl = "";
    browserVideoPromptOpen = false;
    openPlayerFromUrl(url);
});

queueDriveLinkButton?.addEventListener("click", () => {
    const url = getDriveLinkFromInput();
    if (!url) return;

    mediaUrlInput.value = url;
    addQueueFromUrl(url);
});

openDriveLoginButton?.addEventListener("click", () => {
    setBrowserSite("drive", { load: false });
    const authUrl = `${APP_SERVER_ORIGIN}/api/drive/auth/start`;
    if (typeof browserWebview.loadURL === "function") {
        browserWebview.loadURL(authUrl);
    } else {
        browserWebview.src = authUrl;
    }
    setBrowserLoading(true, "Connecting Drive");
    setMediaStatus("Sign in to Drive API", "");
});

driveLinkInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    openDriveLinkButton?.click();
});

playerFullscreenButton.onclick = async () => {
    try {
        if (document.fullscreenElement === playerStage) {
            await document.exitFullscreen();
            return;
        }

        await playerStage.requestFullscreen();
    } catch {
        setMediaStatus("Fullscreen unavailable", "is-offline");
    }
};

function setFullscreenControlsActive() {
    if (!playerStage || document.fullscreenElement !== playerStage) return;

    playerStage.classList.remove("is-fullscreen-controls-idle");
    playerStage.classList.add("is-fullscreen-controls-active");

    clearTimeout(fullscreenControlsIdleTimer);
    fullscreenControlsIdleTimer = setTimeout(() => {
        if (document.fullscreenElement !== playerStage) return;
        if (
            document.activeElement === fullscreenMessageInput ||
            document.activeElement === messageInput ||
            playerControls?.contains(document.activeElement)
        ) {
            setFullscreenControlsActive();
            return;
        }

        playerStage.classList.remove("is-fullscreen-controls-active");
        playerStage.classList.add("is-fullscreen-controls-idle");
    }, 2200);
}

function clearFullscreenControlsIdle() {
    clearTimeout(fullscreenControlsIdleTimer);
    fullscreenControlsIdleTimer = null;
    playerStage?.classList.remove("is-fullscreen-controls-active", "is-fullscreen-controls-idle");
}

["pointermove", "pointerdown", "keydown", "wheel"].forEach(eventName => {
    playerStage?.addEventListener(eventName, setFullscreenControlsActive, { passive: true });
});

document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === playerStage;
    playerFullscreenButton.classList.toggle("is-fullscreen", isFullscreen);
    playerFullscreenButton.title = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
    playerFullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");

    if (fullscreenChatToggleButton) {
        fullscreenChatToggleButton.hidden = !isFullscreen;
    }

    if (fullscreenChatEl) {
        fullscreenChatEl.hidden = !isFullscreen || !isFullscreenChatVisible;
    }

    if (!isFullscreen && document.activeElement === fullscreenMessageInput) {
        window.watchParty?.setChatFocused?.(false);
        messageInput.focus({ preventScroll: true });
    }

    if (!isFullscreen) {
        setArmedFullscreenEffect("");
        setFullscreenEffectTrayVisible(false);
        clearFullscreenControlsIdle();
    } else {
        setFullscreenControlsActive();
    }

    setFullscreenChatVisible(isFullscreenChatVisible);

    requestAnimationFrame(syncPlayerWebviewSize);
});

setInterval(async () => {
    if (!shouldBroadcastPlaybackState() || handlingPlaybackEnd || playerWebview.src === "about:blank") return;

    if (!isLightYoutubePlayerUrl(playerWebview.src)) {
        skipYoutubeAdsInPlayer();
    }

    const state = await readPlaybackState();

    if (state?.ended) {
        handlePlaybackEnded();
    }
}, 900);

setInterval(() => {
    if (!isLightYoutubePlayerUrl(playerWebview.src)) {
        skipYoutubeAdsInPlayer();
    }
}, 1500);

setInterval(() => {
    if (!lastPlaybackState || isSeekingPlayback) return;

    const displayState = getDisplayPlaybackState(lastPlaybackState);

    updatePlaybackTime(displayState);
    updateQueueCountdown(displayState);
}, 500);

setInterval(async () => {
    if (!shouldBroadcastPlaybackState() || applyingRemotePlayback) return;

    const state = await readPlaybackState();

    if (state?.ended) {
        handlePlaybackEnded();
        return;
    }

    if (state) {
        lastPlaybackState = withLocalSyncState({
            ...state,
            updatedAt: Date.now()
        });
        updatePlaybackTime(getDisplayPlaybackState(lastPlaybackState));

        socket.emit("mediaControl", {
            room: roomCode,
            currentTime: state.currentTime,
            duration: state.duration,
            paused: state.paused,
            quality: selectedQuality
        });
    }
}, 3000);

document.getElementById("leave").onclick = () => {
    socket.emit("leaveRoom");
    window.location.href = "index.html";
};
