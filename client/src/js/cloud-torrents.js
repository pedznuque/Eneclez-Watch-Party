// Room-authorized provisioning keeps the cloud administration key out of apps.
async function prepareTorrentSource(request) {
    const parsed = parseTorrentLink(request.magnet);
    if (!request.cloud && !parsed?.cloud) return window.watchParty.prepareTorrent(request);
    if (!socket.connected) return { ok:false, error:"Reconnect to the room before loading a cloud torrent." };
    return new Promise(resolve => {
        let settled = false;
        const finish = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
        const timer = setTimeout(() => finish({ ok:false, error:"Cloud preparation timed out. Check the room server's cloud connection." }), 65000);
        socket.emit("prepareCloudTorrent", { room:roomCode, magnet:request.magnet, fileIndex:request.fileIndex ?? parsed?.fileIndex }, finish);
    });
}
async function readTorrentSourceStatus(torrent) {
    if (!torrent?.cloud) return window.watchParty.torrentStatus();
    const response = await fetch(torrent.statusUrl, { signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(response.status === 404 || response.status === 410 ? "Cloud cache expired. Find videos again to reconnect." : "Cloud status is temporarily unavailable.");
    return { ...await response.json(), ok:true };
}
