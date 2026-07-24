const { app, BrowserWindow, Menu, dialog, ipcMain, session, webContents } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let activeChatWebContentsId = null;
let mainWindow = null;
let updatePromptOpen = false;
let isCheckingForUpdates = false;
let latestDriveMediaUrl = null;
const protectedSessions = new Set();

const BLOCKED_REQUEST_HOSTS = [
 "doubleclick.net",
 "googleadservices.com",
 "googlesyndication.com",
 "pagead2.googlesyndication.com",
 "securepubads.g.doubleclick.net",
 "adservice.google.com",
 "imasdk.googleapis.com",
 "ads.youtube.com",
 "ad.doubleclick.net",
 "static.doubleclick.net",
 "tpc.googlesyndication.com",
 "googleads.g.doubleclick.net",
 "google-analytics.com",
 "analytics.google.com",
 "googletagmanager.com",
 "scorecardresearch.com",
 "quantserve.com",
 "outbrain.com",
 "taboola.com"
];

function shouldBlockRequest(url) {
 try {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.toLowerCase();
  const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`.toLowerCase();
  const isYoutubeHost = host === "www.youtube.com" || host === "youtube.com" || host.endsWith(".youtube.com");

  if (BLOCKED_REQUEST_HOSTS.some(blockedHost => host === blockedHost || host.endsWith(`.${blockedHost}`))) {
   return true;
  }

  return isYoutubeHost && (
   pathAndQuery.includes("/pagead/") ||
   pathAndQuery.includes("/get_midroll_info") ||
   pathAndQuery.includes("/get_video_info") && pathAndQuery.includes("adformat") ||
   pathAndQuery.includes("/youtubei/v1/player/ad_break") ||
   pathAndQuery.includes("/youtubei/v1/log_event") ||
   pathAndQuery.includes("/youtubei/v1/att/get") ||
   pathAndQuery.includes("/api/stats/playback") ||
   pathAndQuery.includes("/ptracking") ||
   pathAndQuery.includes("/pcs/activeview") ||
   pathAndQuery.includes("/pagead") ||
   pathAndQuery.includes("adformat=") ||
   pathAndQuery.includes("ad_type=") ||
   pathAndQuery.includes("adunit") ||
   pathAndQuery.includes("/api/stats/atr") ||
   pathAndQuery.includes("/api/stats/ads") ||
   pathAndQuery.includes("/api/stats/qoe") ||
   pathAndQuery.includes("/api/stats/watchtime") ||
   pathAndQuery.includes("/generate_204")
  );
 } catch {
  return false;
 }
}

function protectSession(session) {
 if (!session || protectedSessions.has(session)) return;

 protectedSessions.add(session);
 session.webRequest.onBeforeRequest((details, callback) => {
  try {
   const parsedUrl = new URL(details.url);
   const host = parsedUrl.hostname.toLowerCase();
   const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`.toLowerCase();
   const isDriveMedia =
    host.includes("googleusercontent.com") ||
    host.includes("googlevideo.com") ||
    host.includes("usercontent.google.com") ||
    pathAndQuery.includes("videoplayback");

   if (isDriveMedia && !shouldBlockRequest(details.url)) {
    latestDriveMediaUrl = {
     url: details.url,
     capturedAt: Date.now()
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
     mainWindow.webContents.send("watch-party-drive-media-url", latestDriveMediaUrl);
    }
   }
  } catch {}

  callback({ cancel: shouldBlockRequest(details.url) });
 });
}

ipcMain.on("watch-party-chat-focus", (event, focused) => {
 activeChatWebContentsId = focused ? event.sender.id : null;
});

ipcMain.on("watch-party-chat-focus-clear", event => {
 if (activeChatWebContentsId === event.sender.id) {
  activeChatWebContentsId = null;
 }
});


function isAllowedNavigation(url) {
 try {
  const parsedUrl = new URL(url);
  return ["about:", "file:", "http:", "https:"].includes(parsedUrl.protocol);
 } catch {
  return false;
 }
}

function isAllowedPopup(url) {
 try {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  const allowedHosts = [
   "accounts.google.com",
   "facebook.com",
   "google.com",
   "passport.bilibili.com",
   "passport.bilibili.tv"
  ];

  return parsedUrl.protocol === "https:" &&
   allowedHosts.some(allowedHost => host === allowedHost || host.endsWith(`.${allowedHost}`));
 } catch {
  return false;
 }
}

function sendUpdateStatus(status) {
 if (!mainWindow || mainWindow.isDestroyed()) return;
 mainWindow.webContents.send("watch-party-update-status", status);
}

function setupAutoUpdates() {
 if (!app.isPackaged) return;

 autoUpdater.autoDownload = true;
 autoUpdater.autoInstallOnAppQuit = true;

 autoUpdater.on("checking-for-update", () => {
  isCheckingForUpdates = true;
  sendUpdateStatus({
   state: "checking",
   message: "Checking for updates..."
  });
 });

 autoUpdater.on("update-available", info => {
  sendUpdateStatus({
   state: "available",
   version: info.version,
   message: `Downloading Eneclez Watch Party ${info.version}...`
  });
 });

 autoUpdater.on("update-not-available", () => {
  isCheckingForUpdates = false;
  sendUpdateStatus({
   state: "current",
   message: "You are on the latest version."
  });
 });

 autoUpdater.on("download-progress", progress => {
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
  sendUpdateStatus({
   state: "downloading",
   percent,
   message: `Downloading update ${percent}%`
  });
 });

 autoUpdater.on("update-downloaded", async info => {
  isCheckingForUpdates = false;
  sendUpdateStatus({
   state: "ready",
   version: info.version,
   message: `Version ${info.version} is ready to install.`
  });

  if (updatePromptOpen) return;

  updatePromptOpen = true;
  const result = await dialog.showMessageBox(mainWindow, {
   type: "info",
   buttons: ["Restart now", "Later"],
   defaultId: 0,
   cancelId: 1,
   title: "Update ready",
   message: `Eneclez Watch Party ${info.version} is ready.`,
   detail: "Restart the app to install the new version."
  });
  updatePromptOpen = false;

  if (result.response === 0) {
   autoUpdater.quitAndInstall(false, true);
  }
 });

 autoUpdater.on("error", error => {
  isCheckingForUpdates = false;
  console.warn("Update check failed:", error?.message || error);
  sendUpdateStatus({
   state: "error",
   message: "Could not check for updates. Try again later."
  });
 });
}

function checkForUpdatesSoon() {
 if (!app.isPackaged) return;

 setTimeout(() => {
  autoUpdater.checkForUpdates().catch(error => {
   console.warn("Update check failed:", error?.message || error);
  });
 }, 4000);
}

ipcMain.handle("watch-party-get-app-info", () => ({
 version: app.getVersion(),
 isPackaged: app.isPackaged
}));

ipcMain.handle("watch-party-check-for-updates", async () => {
 if (!app.isPackaged) {
  return {
   ok: false,
   state: "dev",
   message: "Update checks work in the installed app."
  };
 }

 if (isCheckingForUpdates) {
  return {
   ok: true,
   state: "checking",
   message: "Already checking for updates..."
  };
 }

 try {
  await autoUpdater.checkForUpdates();
  return {
   ok: true,
   state: "checking",
   message: "Checking for updates..."
  };
 } catch (error) {
  console.warn("Manual update check failed:", error?.message || error);
  return {
   ok: false,
   state: "error",
   message: "Could not check for updates. Try again later."
  };
 }
});

ipcMain.handle("watch-party-get-drive-media-url", () => latestDriveMediaUrl);

ipcMain.handle("watch-party-clear-cache", async () => {
 const appSession = session.defaultSession;
 const browserSession = session.fromPartition("persist:eneclez-browser");

 await appSession.clearCache();

 await browserSession.clearCache();
 await browserSession.clearStorageData({
  storages: [
   "appcache",
   "cachestorage",
   "cookies",
   "indexdb",
   "localstorage",
   "serviceworkers",
   "websql"
  ]
 });

 if (typeof browserSession.clearAuthCache === "function") {
  await browserSession.clearAuthCache();
 }

 latestDriveMediaUrl = null;

 return {
  ok: true,
  message: "Browser cache cleared. Restart the app if a site still looks stale."
 };
});

app.on("web-contents-created", (_event, contents) => {
 protectSession(contents.session);
 contents.setWindowOpenHandler(({ url }) => ({
  action: contents.getType() === "webview" && isAllowedPopup(url) ? "allow" : "deny"
 }));

 contents.on("will-navigate", event => {
  const url = event.url || "";

  if (!isAllowedNavigation(url)) {
   event.preventDefault();
  }
 });

 contents.on("before-input-event", (event, input) => {
  if (!activeChatWebContentsId) return;

  const target = webContents.fromId(activeChatWebContentsId);
  if (!target || target.isDestroyed()) {
   activeChatWebContentsId = null;
   return;
  }

  // Let the renderer handle keys normally when it already owns focus.
  if (contents.id === activeChatWebContentsId) return;

  // Forward keys that are being captured by an Electron webview.
  if (contents.getType() !== "webview") return;

  event.preventDefault();
  target.send("watch-party-chat-key", {
   type: input.type,
   key: input.key,
   code: input.code,
   shift: Boolean(input.shift),
   control: Boolean(input.control),
   alt: Boolean(input.alt),
   meta: Boolean(input.meta)
  });
 });

 contents.once("destroyed", () => {
  if (activeChatWebContentsId === contents.id) {
   activeChatWebContentsId = null;
  }
 });
});

app.whenReady().then(() => {
 Menu.setApplicationMenu(null);
 setupAutoUpdates();

 mainWindow = new BrowserWindow({
  width: 1200,
  height: 750,
  autoHideMenuBar: true,
  icon: path.join(__dirname, "src", "assets", "app-icon.png"),
  webPreferences: {
   preload: path.join(__dirname, "preload.js"),
   webviewTag: true
  }
 });
 mainWindow.setMenu(null);
 mainWindow.loadFile("src/index.html");
 mainWindow.webContents.once("did-finish-load", checkForUpdatesSoon);
});
