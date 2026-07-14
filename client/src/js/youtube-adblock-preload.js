(() => {
    const YOUTUBE_HOST_RE = /(^|\.)youtube(?:-nocookie)?\.com$/i;
    const GOOGLE_VIDEO_RE = /(^|\.)googlevideo\.com$/i;
    const AD_KEY_RE = /(?:^|_|-)(ad|ads|adslot|adslots|adplacement|adplacements|playerads|playerad|adbreak|adbreaks|adparams|admarkers|adcue|adcuepoints|adtracking|adurl)(?:$|_|-)/i;
    const AD_URL_RE = /(?:doubleclick|googleads|googlesyndication|pagead|adformat=|ad_type=|adunit|afv_ad_tag|ad_break|ptracking|activeview|\/api\/stats\/ads|\/api\/stats\/atr)/i;

    const isYoutube = () => YOUTUBE_HOST_RE.test(location.hostname);

    const isAdLikeUrl = value => {
        try {
            const url = new URL(String(value), location.href);
            const host = url.hostname.toLowerCase();
            const text = `${url.hostname}${url.pathname}${url.search}`.toLowerCase();

            return AD_URL_RE.test(text) ||
                (GOOGLE_VIDEO_RE.test(host) && (
                    url.searchParams.has("adformat") ||
                    url.searchParams.has("ad_type") ||
                    url.searchParams.has("afv_ad_tag")
                ));
        } catch {
            return AD_URL_RE.test(String(value || ""));
        }
    };

    const stripAds = value => {
        if (!value || typeof value !== "object") return value;

        if (Array.isArray(value)) {
            return value
                .filter(item => !looksLikeAdObject(item))
                .map(stripAds);
        }

        for (const key of Object.keys(value)) {
            const item = value[key];

            if (AD_KEY_RE.test(key)) {
                delete value[key];
                continue;
            }

            if (typeof item === "string" && isAdLikeUrl(item)) {
                delete value[key];
                continue;
            }

            if (looksLikeAdObject(item)) {
                delete value[key];
                continue;
            }

            if (item && typeof item === "object") {
                value[key] = stripAds(item);
            }
        }

        return value;
    };

    const looksLikeAdObject = item => {
        if (!item || typeof item !== "object") return false;

        const keys = Object.keys(item).join(" ");
        if (AD_KEY_RE.test(keys)) return true;

        const text = JSON.stringify(item).slice(0, 5000);
        return AD_URL_RE.test(text) ||
            /"kind"\s*:\s*"youtube#(?:ad|playerAd)/i.test(text) ||
            /"layout"\s*:\s*"(?:display|video)_ad/i.test(text);
    };

    const sanitizeTextResponse = text => {
        if (!isYoutube() || !text || !/[{\[]/.test(text) || !/(adPlacements|playerAds|adSlots|adBreak|pagead|doubleclick|googleads)/i.test(text)) {
            return text;
        }

        try {
            return JSON.stringify(stripAds(JSON.parse(text)));
        } catch {
            return text
                .replace(/"adPlacements"\s*:\s*\[[\s\S]*?\]\s*,?/g, "")
                .replace(/"playerAds"\s*:\s*\[[\s\S]*?\]\s*,?/g, "")
                .replace(/"adSlots"\s*:\s*\[[\s\S]*?\]\s*,?/g, "")
                .replace(/"adBreakHeartbeatParams"\s*:\s*"[^"]*"\s*,?/g, "");
        }
    };

    const patchFetch = () => {
        if (window.__watchPartyFetchPatched || typeof fetch !== "function") return;
        window.__watchPartyFetchPatched = true;

        const originalFetch = fetch.bind(window);

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            const url = response.url || String(args[0]?.url || args[0] || "");

            if (!isYoutube() || !/youtubei\/v1\/player|\/get_video_info|player\?/.test(url)) {
                return response;
            }

            const text = await response.clone().text().catch(() => "");
            const cleanText = sanitizeTextResponse(text);

            if (cleanText === text) return response;

            return new Response(cleanText, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        };
    };

    const patchXhr = () => {
        if (window.__watchPartyXhrPatched || typeof XMLHttpRequest !== "function") return;
        window.__watchPartyXhrPatched = true;

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
            this.__watchPartyUrl = String(url || "");
            return originalOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function patchedSend(...args) {
            this.addEventListener("readystatechange", () => {
                if (this.readyState !== 4 || !isYoutube() || !/youtubei\/v1\/player|\/get_video_info|player\?/.test(this.__watchPartyUrl || "")) return;

                const cleanText = sanitizeTextResponse(this.responseText);
                if (cleanText === this.responseText) return;

                try {
                    Object.defineProperty(this, "responseText", { value: cleanText });
                    Object.defineProperty(this, "response", { value: cleanText });
                } catch {}
            });

            return originalSend.apply(this, args);
        };
    };

    const installRuntimeCleaner = () => {
        if (!isYoutube()) return;

        const installTheaterStyle = () => {
            if (!/\/watch\b/i.test(location.pathname)) return;

            let style = document.getElementById("watch-party-youtube-theater-style");
            if (!style) {
                style = document.createElement("style");
                style.id = "watch-party-youtube-theater-style";
                document.documentElement.appendChild(style);
            }

            style.textContent = `
                html,
                body,
                ytd-app,
                ytd-page-manager,
                ytd-watch-flexy {
                    width: 100vw !important;
                    height: 100vh !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    background: #000 !important;
                }

                ytd-masthead,
                #masthead-container,
                #guide,
                tp-yt-app-drawer,
                ytd-mini-guide-renderer,
                #secondary,
                #related,
                #comments,
                #chat,
                #below,
                #bottom-row,
                #info,
                #meta,
                #meta-contents,
                #description,
                ytd-watch-metadata,
                ytd-video-primary-info-renderer,
                ytd-video-secondary-info-renderer,
                ytd-rich-section-renderer,
                ytd-reel-shelf-renderer,
                ytd-ad-slot-renderer,
                ytd-companion-slot-renderer,
                #player-ads {
                    display: none !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }

                #columns,
                #primary,
                #primary-inner,
                #player,
                #player-container,
                #player-container-outer,
                #player-theater-container,
                ytd-player,
                #movie_player,
                .html5-video-player,
                .html5-video-container {
                    position: fixed !important;
                    inset: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    min-width: 100vw !important;
                    min-height: 100vh !important;
                    max-width: none !important;
                    max-height: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    transform: none !important;
                    background: #000 !important;
                    z-index: 2147483000 !important;
                }

                video,
                video.video-stream,
                .html5-main-video {
                    width: 100vw !important;
                    height: 100vh !important;
                    max-width: none !important;
                    max-height: none !important;
                    object-fit: contain !important;
                    object-position: center center !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    filter: none !important;
                    background: #000 !important;
                }

                .ytp-chrome-bottom,
                .ytp-chrome-top {
                    z-index: 2147483200 !important;
                }
            `;
        };

        const applyTheaterLayout = () => {
            if (!/\/watch\b/i.test(location.pathname)) return;

            installTheaterStyle();
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;

            document.querySelectorAll([
                "ytd-masthead",
                "#masthead-container",
                "#secondary",
                "#below",
                "#bottom-row",
                "ytd-watch-metadata",
                "#comments",
                "#related"
            ].join(",")).forEach(element => {
                element.style.setProperty("display", "none", "important");
            });

            document.querySelectorAll([
                "#columns",
                "#primary",
                "#primary-inner",
                "#player",
                "#player-container",
                "#player-container-outer",
                "#player-theater-container",
                "ytd-player",
                "#movie_player",
                ".html5-video-player",
                ".html5-video-container"
            ].join(",")).forEach(element => {
                element.style.setProperty("position", "fixed", "important");
                element.style.setProperty("inset", "0", "important");
                element.style.setProperty("width", "100vw", "important");
                element.style.setProperty("height", "100vh", "important");
                element.style.setProperty("max-width", "none", "important");
                element.style.setProperty("max-height", "none", "important");
                element.style.setProperty("margin", "0", "important");
                element.style.setProperty("padding", "0", "important");
                element.style.setProperty("overflow", "hidden", "important");
                element.style.setProperty("background", "#000", "important");
            });
        };

        const clean = () => {
            applyTheaterLayout();

            const player = document.querySelector("#movie_player");
            const hasVisibleAdElement = Array.from(document.querySelectorAll([
                ".ytp-ad-player-overlay",
                ".ytp-ad-text",
                ".ytp-ad-preview-container",
                ".ytp-ad-skip-button",
                ".ytp-ad-skip-button-modern",
                ".ytp-skip-ad-button",
                ".ytp-ad-simple-ad-badge",
                ".ytp-ad-player-overlay-instream-info"
            ].join(","))).some(element => {
                const rect = element.getBoundingClientRect?.();
                const style = getComputedStyle(element);
                return Boolean(rect?.width && rect?.height) &&
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    Number(style.opacity || 1) > 0;
            });
            const isAdMode = Boolean(
                hasVisibleAdElement ||
                player?.classList?.contains("ad-showing") ||
                player?.classList?.contains("ad-interrupting")
            );

            if (isAdMode) {
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
                player?.querySelectorAll?.(".ad-showing, .ad-interrupting, .ad-created").forEach(element => {
                    element.classList.remove("ad-showing", "ad-interrupting", "ad-created");
                });
            } else {
                document.querySelectorAll("video").forEach(video => {
                    if (video.playbackRate > 4) video.playbackRate = 1;
                });
            }

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
            ].join(",")).forEach(element => {
                element.remove();
            });
        };

        let cleanScheduled = false;
        const scheduleClean = () => {
            if (cleanScheduled) return;

            cleanScheduled = true;
            requestAnimationFrame(() => {
                cleanScheduled = false;
                clean();
            });
        };

        clean();
        document.addEventListener("yt-navigate-finish", scheduleClean, true);
        document.addEventListener("yt-page-data-updated", scheduleClean, true);
        document.addEventListener("yt-player-updated", scheduleClean, true);

        if (!window.__watchPartyAdCleanerObserver) {
            window.__watchPartyAdCleanerObserver = new MutationObserver(scheduleClean);
            window.__watchPartyAdCleanerObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class", "src", "style"]
            });
            window.setInterval(clean, 1000);
            window.setInterval(applyTheaterLayout, 1200);
        }
    };

    document.addEventListener("DOMContentLoaded", installRuntimeCleaner, { once: true });
    setTimeout(installRuntimeCleaner, 0);
})();
