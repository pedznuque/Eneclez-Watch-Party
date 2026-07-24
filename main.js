const {app, BrowserWindow, Menu} = require("electron");
const path=require("path");

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

app.on("web-contents-created", (_event, contents) => {
 protectSession(contents.session);
});

function createWindow(){
 Menu.setApplicationMenu(null);

 const win=new BrowserWindow({
  width:1200,
  height:750,
  autoHideMenuBar:true,
  webPreferences:{
   preload:path.join(__dirname,"preload.js")
  }
 });
 win.setMenu(null);
 win.loadFile("src/index.html");
}

app.whenReady().then(createWindow);
