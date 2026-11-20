const path = require("node:path");
const { TorrentService } = require("../client/torrent-service.cjs");
const { createCloudCache } = require("./cloud-cache.cjs");
const cache = createCloudCache({
    apiKey:process.env.CLOUD_CACHE_KEY,
    publicOrigin:process.env.CLOUD_CACHE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3100}`,
    cachePath:process.env.CLOUD_CACHE_PATH || path.join(__dirname, "cloud-data"),
    maxTorrents:Number(process.env.CLOUD_CACHE_MAX_TORRENTS || 3),
    maxBytes:Number(process.env.CLOUD_CACHE_MAX_GB || 30) * 1024 ** 3,
    idleMs:Number(process.env.CLOUD_CACHE_IDLE_MINUTES || 60) * 60000,
    maxStreams:Number(process.env.CLOUD_CACHE_MAX_STREAMS || 12),
    serviceFactory:directory => new TorrentService(directory, { natUpnp:false, natPmp:false })
});
const server = cache.app.listen(process.env.PORT || 3100, () => console.log("Watch Party cloud cache started"));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { server.close(); await cache.close(); server.closeAllConnections(); });
