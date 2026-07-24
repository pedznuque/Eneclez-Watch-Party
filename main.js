const {app, BrowserWindow, Menu, ipcMain, desktopCapturer, session} = require("electron");
const events = require("events");
const path=require("path");

const WEB_CONTENTS_MAX_LISTENERS = 100;

events.defaultMaxListeners = Math.max(events.defaultMaxListeners, WEB_CONTENTS_MAX_LISTENERS);

let mainWindow = null;
let latestDriveMediaUrl = "";
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

function isLikelyDriveMediaUrl(url) {
 try {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.toLowerCase();
  const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`.toLowerCase();

  if (
   host.includes("googlevideo.com") ||
   pathAndQuery.includes("videoplayback")
  ) {
   return true;
  }

  return (
   (
    host.includes("googleusercontent.com") ||
    host.includes("usercontent.google.com")
   ) &&
   !host.startsWith("lh") &&
   !pathAndQuery.includes("/ogw/") &&
   !pathAndQuery.match(/\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i)
  );
 } catch {
  return false;
 }
}

function rememberDriveMediaUrl(url) {
 if (!url || !isLikelyDriveMediaUrl(url)) return;

 latestDriveMediaUrl = url;
 if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send("watch-party-drive-media-url", {
   url,
   capturedAt: Date.now()
  });
 }
}

function hasVideoContentType(headers = {}) {
 const contentTypeHeader = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type")?.[1];
 const values = Array.isArray(contentTypeHeader) ? contentTypeHeader : [contentTypeHeader];
 return values.some(value => String(value || "").toLowerCase().startsWith("video/"));
}

function protectSession(session) {
 if (!session || protectedSessions.has(session)) return;

 protectedSessions.add(session);
 session.webRequest.onBeforeRequest((details, callback) => {
  rememberDriveMediaUrl(details.url);
  callback({ cancel: shouldBlockRequest(details.url) });
 });
 session.webRequest.onHeadersReceived((details, callback) => {
  if (hasVideoContentType(details.responseHeaders)) {
   rememberDriveMediaUrl(details.url);
  }
  callback({});
 });
}

app.on("web-contents-created", (_event, contents) => {
 contents.setMaxListeners(Math.max(contents.getMaxListeners(), WEB_CONTENTS_MAX_LISTENERS));
 protectSession(contents.session);
});

ipcMain.handle("watch-party-get-drive-media-url", async () => ({
 ok: Boolean(latestDriveMediaUrl),
 url: latestDriveMediaUrl
}));

function setupCaptionDisplayCapture() {
 const targetSession = session.defaultSession;
 if (!targetSession?.setDisplayMediaRequestHandler) return;

 targetSession.setDisplayMediaRequestHandler((_request, callback) => {
  desktopCapturer.getSources({
   types: ["screen", "window"],
   thumbnailSize: { width: 1, height: 1 }
  }).then(sources => {
   const screenSource = sources.find(source => source.id.startsWith("screen:")) || sources[0];

   if (!screenSource) {
    callback({});
    return;
   }

   callback({
    video: screenSource,
    audio: "loopback"
   });
  }).catch(() => {
   callback({});
  });
 });
}

function createWindow(){
 Menu.setApplicationMenu(null);

 mainWindow=new BrowserWindow({
  width:1200,
  height:750,
  autoHideMenuBar:true,
  webPreferences:{
   preload:path.join(__dirname,"preload.js")
  }
 });
 mainWindow.setMenu(null);
 mainWindow.loadFile("src/index.html");
}

app.whenReady().then(() => {
 setupCaptionDisplayCapture();
 createWindow();
});
