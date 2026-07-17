const { app, BrowserWindow, Menu, dialog, ipcMain, webContents } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let activeChatWebContentsId = null;
let mainWindow = null;
let updatePromptOpen = false;
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

function setupAutoUpdates() {
 if (!app.isPackaged) return;

 autoUpdater.autoDownload = true;
 autoUpdater.autoInstallOnAppQuit = true;

 autoUpdater.on("update-downloaded", async info => {
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
  console.warn("Update check failed:", error?.message || error);
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
  webPreferences: {
   preload: path.join(__dirname, "preload.js"),
   webviewTag: true
  }
 });
 mainWindow.setMenu(null);
 mainWindow.loadFile("src/index.html");
 mainWindow.webContents.once("did-finish-load", checkForUpdatesSoon);
});
