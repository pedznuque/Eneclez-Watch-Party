function parseTorrentLink(value) {
    try {
        if (typeof value !== "string" || value.length > 2048) return null;
        const url = new URL(value.trim());
        if (url.protocol !== "magnet:") return null;
        const hash = url.searchParams.getAll("xt").map(topic => topic.match(/^urn:btih:([a-f0-9]{40}|[a-z2-7]{32})$/i)?.[1]).find(Boolean);
        const file = url.searchParams.get("wpFile");
        const cloud = url.searchParams.get("wpCloud");
        if (cloud !== null && cloud !== "1") return null;
        if (!hash || (file !== null && !/^\d{1,5}$/.test(file))) return null;
        url.searchParams.delete("wpFile");
        url.searchParams.delete("wpCloud");
        const magnet = url.href.replace(/([?&])xt=urn%3Abtih%3A/ig, "$1xt=urn:btih:");
        return { hash: hash.toLowerCase(), magnet, cloud: cloud === "1", fileIndex: file === null ? null : Number(file), name: url.searchParams.get("dn") || "Torrent video" };
    } catch { return null; }
}

function formatTorrentSpeed(bytesPerSecond) {
    const rate = Math.max(0, Number(bytesPerSecond) || 0);
    const bytes = rate >= 1000000 ? `${(rate / 1000000).toFixed(2)} MB/s` : `${Math.round(rate / 1000)} KB/s`;
    return `${bytes} (${(rate * 8 / 1000000).toFixed(2)} Mbps)`;
}

if (typeof module !== "undefined" && module.exports) module.exports = { parseTorrentLink, formatTorrentSpeed };
