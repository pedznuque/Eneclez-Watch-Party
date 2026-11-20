const { parseTorrentLink } = require("../client/src/js/torrent-links");
function cloudConfigured(env) { return Boolean(env.CLOUD_CACHE_URL && env.CLOUD_CACHE_KEY); }
async function prepareCloudTorrent(env, request) {
    if (!cloudConfigured(env)) throw new Error("Cloud cache is not configured on this room server. Choose On this device or connect a cloud worker.");
    const base = new URL(env.CLOUD_CACHE_URL);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid cloud cache server configuration");
    const parsed = parseTorrentLink(request.magnet);
    if (!parsed) throw new Error("Invalid torrent link");
    const response = await fetch(new URL("/api/torrents", base), {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${env.CLOUD_CACHE_KEY}` },
        body:JSON.stringify({ magnet:parsed.magnet, fileIndex:request.fileIndex ?? parsed.fileIndex }), signal:AbortSignal.timeout(60000), redirect:"error"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Cloud cache could not prepare this torrent");
    const allowed = new URL(env.CLOUD_CACHE_PUBLIC_URL || env.CLOUD_CACHE_URL).origin;
    for (const value of [result.playerUrl, result.statusUrl].filter(Boolean)) {
        const url = new URL(value);
        if (url.origin !== allowed || !/^\/cache\/[a-f0-9]{48}\/(player|status)$/.test(url.pathname)) throw new Error("Cloud worker returned an invalid stream address");
    }
    if (!result.statusUrl || !Array.isArray(result.files) || (request.fileIndex != null && !result.playerUrl)) throw new Error("Cloud worker returned incomplete video information");
    return result;
}
module.exports = { cloudConfigured, prepareCloudTorrent };
