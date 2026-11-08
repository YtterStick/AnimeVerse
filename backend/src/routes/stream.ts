import { Router, Request, Response, NextFunction } from "express";
import axios from "axios";
import ConsumetStreamProvider from "../services/consumetStreamProvider";

const router = Router();
const streamProvider = new ConsumetStreamProvider();

/**
 * Clean malformed URLs (e.g. "https:///subbl.krussdomi.com/..." or "https:////bl.krussdomi.com/...")
 */
function sanitizeRemoteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed.replace(/^\/+/, "//")}`;
  }
  return trimmed
    .replace(/^https?:\/{3,}/i, "https://")
    .replace(/^https:https:\/\//i, "https://")
    .replace(/^http:\/\//i, "https://");
}

/**
 * Resolve a URL that may be relative, protocol-relative, or absolute
 * into a full https:// URL.
 */
function resolveUrl(url: string, base: string): string {
  const cleaned = sanitizeRemoteUrl(url);
  if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) {
    return cleaned.replace(/^http:\/\//i, "https://");
  }
  try {
    return new URL(cleaned, base).toString();
  } catch {
    return cleaned;
  }
}

/**
 * Remove provider watermark cues (e.g. the "kaa.lt" box KickAssAnime injects at 0:00)
 * from a WEBVTT document.
 */
function stripWatermarkCues(vtt: string): string {
  const [header, ...blocks] = vtt.split(/\n{2,}/);
  const watermark = /\b(?:kaa\.lt|kickassanime|kaa\.to|animeheaven\.me)\b/i;
  const kept = blocks.filter((block) => {
    if (!block.includes("-->")) return true;
    const text = block
      .split("\n")
      .filter((line) => !line.includes("-->") && !/^\d+$/.test(line.trim()))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    return !(text && watermark.test(text) && text.length < 40);
  });
  return [header, ...kept].join("\n\n").trimEnd() + "\n";
}

/**
 * Convert SRT subtitle content to WEBVTT if it is not already WEBVTT.
 */
function ensureWebVtt(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (normalized.startsWith("WEBVTT")) {
    return stripWatermarkCues(normalized);
  }

  // Convert SRT numeric cue indices & comma timestamps (00:01:02,345 --> 00:01:05,678) to WEBVTT
  const vttBody = normalized
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2 --> $3.$4")
    .replace(/(\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}),(\d{3})/g, "$1.$2 --> $3.$4");

  return stripWatermarkCues(`WEBVTT\n\n${vttBody}`);
}

/**
 * Rewrite image URLs in WebVTT storyboard files so images are routed through
 * our backend proxy with the correct Referer and CORS headers.
 */
function rewriteThumbnailVtt(
  content: string,
  parentUrl: string,
  proxyBaseUrl: string,
  referer?: string
): string {
  const parentBase = parentUrl.substring(0, parentUrl.lastIndexOf("/") + 1);
  return content.replace(/^([^\r\n]*?\.(?:jpg|jpeg|png|webp)[^\r\n]*?)$/gim, (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("WEBVTT") || trimmed.startsWith("NOTE")) return line;
    const [imgPart, hash] = trimmed.split("#");
    const absoluteImgUrl = imgPart.startsWith("http") ? imgPart : new URL(imgPart, parentBase).toString();
    let proxied = `${proxyBaseUrl}?url=${encodeURIComponent(absoluteImgUrl)}`;
    if (referer) {
      proxied += `&referer=${encodeURIComponent(referer)}`;
    }
    return hash ? `${proxied}#${hash}` : proxied;
  });
}

/**
 * Rewrite ALL URLs in .m3u8 playlists to go through our backend proxy,
 * and optionally pin the desired audio track ("jpn" for SUB, "eng" for DUB)
 * and/or pin a specific resolution (e.g. "1080p", "720p", "360p").
 */
function rewriteM3U8(
  content: string,
  parentUrl: string,
  proxyBaseUrl: string,
  audioPref?: string,
  customReferer?: string,
  qualityPref?: string
): string {
  let rawLines = content.replace(/\r\n/g, "\n").split("\n");
  const parentBase = parentUrl.substring(0, parentUrl.lastIndexOf("/") + 1);

  // If audioPref ("eng" or "jpn") is requested and the master playlist has #EXT-X-MEDIA:TYPE=AUDIO tracks,
  // filter/pin the matching language track so hls.js always plays the exact language requested.
  if (audioPref === "eng" || audioPref === "jpn") {
    const audioLines = rawLines.filter((l) => l.trim().startsWith("#EXT-X-MEDIA:TYPE=AUDIO"));
    if (audioLines.length > 1) {
      const matcher =
        audioPref === "eng"
          ? /LANGUAGE="(?:en|eng|en-US|en-GB)"|NAME="[^"]*(?:English|Eng)[^"]*"/i
          : /LANGUAGE="(?:ja|jpn|ja-JP)"|NAME="[^"]*(?:Japanese|Jpn|Original)[^"]*"/i;

      const matchingAudio = audioLines.filter((l) => matcher.test(l));
      if (matchingAudio.length > 0) {
        rawLines = rawLines
          .filter((l) => {
            const t = l.trim();
            if (!t.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) return true;
            return matcher.test(t);
          })
          .map((l) => {
            const t = l.trim();
            if (!t.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) return l;
            // Ensure DEFAULT=YES,AUTOSELECT=YES on the selected audio track
            let updated = t
              .replace(/,DEFAULT=(?:YES|NO)/gi, "")
              .replace(/,AUTOSELECT=(?:YES|NO)/gi, "");
            updated = updated.replace(
              /#EXT-X-MEDIA:TYPE=AUDIO/i,
              "#EXT-X-MEDIA:TYPE=AUDIO,DEFAULT=YES,AUTOSELECT=YES"
            );
            return updated;
          });
      }
    }
  }

  // If qualityPref is requested (e.g. "720p", "1080p"), pin only that video variant in the master playlist
  if (qualityPref) {
    const targetHeight = qualityPref.replace(/[^0-9]/g, "");
    if (targetHeight) {
      const hasMatch = rawLines.some(
        (l) =>
          l.startsWith("#EXT-X-STREAM-INF:") &&
          (l.includes(`x${targetHeight}`) || l.includes(`RESOLUTION=${targetHeight}`))
      );
      if (hasMatch) {
        const filteredLines: string[] = [];
        let skippingVariant = false;
        for (let i = 0; i < rawLines.length; i++) {
          const line = rawLines[i];
          const t = line.trim();
          if (t.startsWith("#EXT-X-STREAM-INF:")) {
            const matchesHeight =
              t.includes(`x${targetHeight}`) || t.includes(`RESOLUTION=${targetHeight}`);
            if (matchesHeight) {
              filteredLines.push(line);
              skippingVariant = false;
            } else {
              skippingVariant = true;
            }
          } else if (skippingVariant && !t.startsWith("#")) {
            skippingVariant = false;
          } else {
            filteredLines.push(line);
          }
        }
        rawLines = filteredLines;
      }
    }
  }

  const isDirectCorsSafeSegment = (targetUrl: string): boolean => {
    try {
      const host = new URL(targetUrl).hostname.toLowerCase();
      return host === "vix-content.net" || host.endsWith(".vix-content.net");
    } catch {
      return false;
    }
  };

  const buildProxyLink = (targetUrl: string) => {
    if (isDirectCorsSafeSegment(targetUrl)) {
      return targetUrl;
    }
    let link = `${proxyBaseUrl}?url=${encodeURIComponent(targetUrl)}`;
    if (customReferer) {
      link += `&referer=${encodeURIComponent(customReferer)}`;
    }
    return link;
  };

  return rawLines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Handle tags with URI="..." attributes
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUri = resolveUrl(uri, parentBase);
          return `URI="${buildProxyLink(absoluteUri)}"`;
        });
      }

      // All other lines are segment/playlist URLs — proxy them all
      const absoluteUrl = resolveUrl(trimmed, parentBase);
      return buildProxyLink(absoluteUrl);
    })
    .join("\n");
}

function buildProxyHeaders(
  url: string,
  referer: string,
  rangeHeader?: string
): Array<Record<string, string>> {
  const targetUrl = new URL(url);
  const origin = targetUrl.origin;
  const refererOrigin = (() => {
    try {
      return new URL(referer).origin;
    } catch {
      return referer;
    }
  })();
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

  const baseRange: Record<string, string> = rangeHeader ? { Range: rangeHeader } : {};

  const extraHeaders: Record<string, string> = {};
  if (targetUrl.hostname.includes("animeheaven")) {
    const hexTokens = targetUrl.search.match(/([a-f0-9]{32})/g);
    if (hexTokens && hexTokens.length > 0) {
      const epKey = hexTokens[hexTokens.length - 1];
      extraHeaders["Cookie"] = `key=${epKey}`;
    }
  }

  return [
    {
      Referer: referer,
      "User-Agent": userAgent,
      ...extraHeaders,
      ...baseRange,
    },
    {
      Referer: referer,
      Origin: refererOrigin,
      "User-Agent": userAgent,
      ...extraHeaders,
      ...baseRange,
    },
    {
      Referer: "https://krussdomi.com/",
      "User-Agent": userAgent,
      ...baseRange,
    },
    {
      Referer: `${origin}/`,
      "User-Agent": userAgent,
      ...extraHeaders,
      ...baseRange,
    },
    {
      "User-Agent": userAgent,
      ...extraHeaders,
      ...baseRange,
    },
  ];
}

// GET /api/stream/proxy
// Proxies .m3u8, .vtt/.srt subtitles, and video segments/mp4s to bypass CORS and Referer checks
router.get("/proxy", async (req: Request, res: Response) => {
  try {
    const rawUrl = req.query.url;
    const audioPref = typeof req.query.audio === "string" ? req.query.audio : undefined;
    const qualityPref = typeof req.query.quality === "string" ? req.query.quality : undefined;
    const customReferer = typeof req.query.referer === "string" ? req.query.referer : undefined;

    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).send("Missing target URL");
    }

    const url = sanitizeRemoteUrl(rawUrl);

    // Determine the correct Referer based on the target domain
    const targetUrl = new URL(url);
    const refererMap: Record<string, string> = {
      "krussdomi.com": "https://krussdomi.com/",
      "advancedairesearchlab.xyz": "https://krussdomi.com/",
      "habibikun.xyz": "https://krussdomi.com/",
      "babybayw.xyz": "https://krussdomi.com/",
      "narutokun.xyz": "https://krussdomi.com/",
      "animeheaven.me": "https://animeheaven.me/",
      "vixcloud.cc": "https://www.animeunity.to/",
      "vixcloud.co": "https://www.animeunity.to/",
      "vix-content.net": "https://www.animeunity.to/",
      "animeunity.to": "https://www.animeunity.to/",
    };

    let referer = customReferer || `${targetUrl.origin}/`;
    if (!customReferer) {
      for (const [domain, ref] of Object.entries(refererMap)) {
        if (targetUrl.hostname.endsWith(domain)) {
          referer = ref;
          break;
        }
      }
      if (
        referer === `${targetUrl.origin}/` &&
        (targetUrl.hostname.endsWith(".xyz") || targetUrl.hostname.includes("krussdomi"))
      ) {
        referer = "https://krussdomi.com/";
      }
    }

    const isSubtitle = /\.(vtt|srt|ass|ssa)(?:[?#]|$)/i.test(url);
    const isPlaylist = !isSubtitle && /(?:\.m3u8(?:[?#]|$)|\/playlist\/)/i.test(url);
    const isMp4 = /video\.mp4|\.mp4(?:[?#]|$)/i.test(url);

    // If client is requesting an MP4 and didn't provide a Range header,
    // default to "bytes=0-" so upstream Apache/nginx sends 206 Partial Content immediately
    let rangeHeader = typeof req.headers.range === "string" ? req.headers.range : undefined;
    if (isMp4 && !rangeHeader) {
      rangeHeader = "bytes=0-";
    }

    const headerAttempts = buildProxyHeaders(url, referer, rangeHeader);

    for (let i = 0; i < headerAttempts.length; i++) {
      try {
        if (isSubtitle) {
          const response = await axios.get(url, {
            headers: headerAttempts[i],
            responseType: "text",
            timeout: 15000,
          });

          res.setHeader("Content-Type", "text/vtt; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cache-Control", "public, max-age=86400");
          const rawText = String(response.data || "");
          const isThumbnailVtt = /#xywh=|\.(?:jpg|jpeg|png|webp)/i.test(rawText);
          if (isThumbnailVtt) {
            res.send(rewriteThumbnailVtt(rawText, url, "/api/stream/proxy", referer));
          } else {
            res.send(ensureWebVtt(rawText));
          }
          return;
        }

        if (isPlaylist) {
          const response = await axios.get(url, {
            headers: headerAttempts[i],
            responseType: "text",
            timeout: 15000,
          });

          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

          const rewritten = rewriteM3U8(
            String(response.data || ""),
            url,
            "/api/stream/proxy",
            audioPref,
            referer,
            qualityPref
          );
          res.send(rewritten);
          return;
        }

        // Binary mode for segments (.jpg, .ts, .m4s) and .mp4 streams
        const response = await axios.get(url, {
          headers: headerAttempts[i],
          responseType: "stream",
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        res.status(response.status);

        const upstreamType = String(response.headers["content-type"] || "");
        const isImage = /\.(jpg|jpeg|png|webp)(?:[?#]|$)/i.test(url) || upstreamType.startsWith("image/");
        const contentType = isMp4
          ? "video/mp4"
          : isImage
          ? (upstreamType.startsWith("image/") ? upstreamType : "image/jpeg")
          : upstreamType && !upstreamType.includes("image/")
          ? upstreamType
          : "video/mp2t";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (!isMp4) {
          res.setHeader("Cache-Control", "public, max-age=86400, immutable");
        }
        if (response.headers["content-length"]) {
          res.setHeader("Content-Length", String(response.headers["content-length"]));
        }
        if (response.headers["content-range"]) {
          res.setHeader("Content-Range", String(response.headers["content-range"]));
        }
        if (response.headers["accept-ranges"]) {
          res.setHeader("Accept-Ranges", String(response.headers["accept-ranges"]));
        } else if (isMp4) {
          res.setHeader("Accept-Ranges", "bytes");
        }

        req.on("close", () => {
          if (response.data && typeof response.data.destroy === "function") {
            response.data.destroy();
          }
        });

        response.data.pipe(res);
        return;
      } catch (attemptError: any) {
        const status = attemptError?.response?.status;
        const lastAttempt = i === headerAttempts.length - 1;

        if (!lastAttempt && (status === 403 || status === 404 || status === 429 || status >= 500)) {
          continue;
        }

        throw attemptError;
      }
    }
  } catch (error: any) {
    console.error("[StreamProxy] Error proxying stream:", error.message);
    if (!res.headersSent) {
      res.status(502).send("Failed to proxy streaming resource");
    }
  }
});

// GET /api/stream/debug/proxy-test?target=...
router.get("/debug/proxy-test", async (req: Request, res: Response) => {
  const target = typeof req.query.target === "string" ? req.query.target : "https://cu.animeheaven.me/video.mp4?e9e0363ca5e03b67def6326835a045ed&073640e721015dbb3f043967abdf0075";
  const results: any[] = [];
  const headerAttempts = buildProxyHeaders(target, "https://animeheaven.me/", "bytes=0-1000");
  for (let i = 0; i < headerAttempts.length; i++) {
    const started = Date.now();
    try {
      const resp = await axios.get(target, {
        headers: headerAttempts[i],
        responseType: "stream",
        timeout: 8000,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      results.push({ attempt: i, ok: true, status: resp.status, ms: Date.now() - started, headers: resp.headers });
      resp.data.destroy();
      return res.json({ success: true, results });
    } catch (err: any) {
      results.push({ attempt: i, ok: false, status: err.response?.status, error: err.message, ms: Date.now() - started });
    }
  }
  res.status(502).json({ success: false, results });
});

// GET /api/stream/debug/ah/:animeId/:episode
// Step-by-step diagnostics for the AnimeHeaven provider
router.get("/debug/ah/:animeId/:episode", async (req: Request, res: Response) => {
  const animeId = parseInt(req.params.animeId, 10);
  const episode = parseInt(req.params.episode, 10);
  try {
    const meta = await (streamProvider as any).getAnimeMetadata(animeId);
    const searchRes = await axios.get(
      `https://animeheaven.me/search.php?s=${encodeURIComponent(meta?.titleEnglish || meta?.title || "")}`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://animeheaven.me/" }, timeout: 6000 }
    );
    const hrefs = [...String(searchRes.data).matchAll(/href=['"](anime\.php\?[a-z0-9]+)['"]/gi)].map((m) => m[1]);
    res.json({ meta, hrefs: hrefs.slice(0, 3) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stream/debug/kaa/:animeId/:episode
// Step-by-step diagnostics for the KickAssAnime provider (status codes per upstream call)
router.get("/debug/kaa/:animeId/:episode", async (req: Request, res: Response) => {
  const animeId = parseInt(req.params.animeId, 10);
  const episode = parseInt(req.params.episode, 10);
  if (isNaN(animeId) || isNaN(episode)) {
    return res.status(400).json({ message: "Invalid parameters" });
  }
  res.json({ steps: await streamProvider.diagnoseKAA(animeId, episode) });
});

// GET /api/stream/debug/au/:query
// Step-by-step diagnostics for AnimeUnity
router.get("/debug/au/:query", async (req: Request, res: Response) => {
  const query = req.params.query;
  res.json(await streamProvider.diagnoseAU(query));
});

// GET /api/stream/skip-times/:animeId/:episode?duration=1440
// Intro (OP) / outro (ED) / recap timestamps from the community AniSkip database
const skipCache = new Map<string, { at: number; data: any }>();
router.get("/skip-times/:animeId/:episode", async (req: Request, res: Response) => {
  const animeId = parseInt(req.params.animeId, 10);
  const episode = parseInt(req.params.episode, 10);
  const duration = Math.max(0, Math.round(Number(req.query.duration) || 0));
  if (isNaN(animeId) || isNaN(episode)) {
    return res.status(400).json({ message: "Invalid parameters" });
  }

  // Include duration in cache key so actual video duration query updates the initial estimate
  const cacheKey = `${animeId}:${episode}:${duration > 0 ? duration : "initial"}`;
  const cached = skipCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) {
    return res.json(cached.data);
  }

  try {
    const types = ["op", "ed", "mixed-op", "mixed-ed", "recap"].map((t) => `types=${t}`).join("&");
    
    // First query with the specified duration
    let response = await axios.get(
      `https://api.aniskip.com/v2/skip-times/${animeId}/${episode}?${types}&episodeLength=${duration}`,
      { timeout: 6000, validateStatus: (s) => s === 200 || s === 404 }
    );

    // If not found with exact duration or duration was 0, fallback to standard episode search (0)
    if ((!response.data?.found || !response.data?.results?.length) && duration > 0) {
      response = await axios.get(
        `https://api.aniskip.com/v2/skip-times/${animeId}/${episode}?${types}&episodeLength=0`,
        { timeout: 5000, validateStatus: (s) => s === 200 || s === 404 }
      );
    }

    const rawResults: any[] = response.data?.found ? response.data.results || [] : [];
    
    // Discard duplicates or bad entries (e.g. Episode 1 OP starting at < 30s is almost always dialogue/prologue)
    const bestByType = new Map<string, any>();
    for (const r of rawResults) {
      const type = String(r.skipType || "").replace("mixed-", "");
      const start = Number(r.interval?.startTime) || 0;
      const end = Number(r.interval?.endTime) || 0;
      const span = end - start;

      // Theme songs are standard ~90 seconds (80s - 105s)
      if (type === "op" || type === "ed") {
        if (span < 45 || span > 130) continue; // Not a valid theme song length
      }

      // In Episode 1, openings starting before 30 seconds are universally story prologues, not songs
      if (type === "op" && episode === 1 && start < 30) {
        continue;
      }

      const current = bestByType.get(type);
      if (!current) {
        bestByType.set(type, r);
      } else {
        // Pick the interval closer to standard 90s OP/ED duration
        const curSpan = (Number(current.interval?.endTime) || 0) - (Number(current.interval?.startTime) || 0);
        if (Math.abs(span - 89.5) < Math.abs(curSpan - 89.5)) {
          bestByType.set(type, r);
        }
      }
    }

    const cleanSkips = Array.from(bestByType.values()).map((r) => ({
      type: String(r.skipType).replace("mixed-", ""),
      start: Number(r.interval?.startTime) || 0,
      end: Number(r.interval?.endTime) || 0,
      episodeLength: Number(r.episodeLength) || 0,
    }));

    const data = {
      found: cleanSkips.length > 0,
      skips: cleanSkips,
    };

    skipCache.set(cacheKey, { at: Date.now(), data });
    res.json(data);
  } catch (error: any) {
    console.warn("[SkipTimes] AniSkip lookup failed:", error.message);
    res.json({ found: false, skips: [] });
  }
});

// GET /api/stream/slug/:animeId
// Resolves KickAssAnime slug from MALSync using backend axios (no browser CORS restrictions)
const slugCache = new Map<number, { at: number; slug: string | null }>();
router.get("/slug/:animeId", async (req: Request, res: Response) => {
  const animeId = parseInt(req.params.animeId, 10);
  if (isNaN(animeId) || !animeId) {
    return res.status(400).json({ slug: null });
  }

  const cached = slugCache.get(animeId);
  if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.json({ slug: cached.slug });
  }

  try {
    const msRes = await axios.get(`https://api.malsync.moe/mal/anime/${animeId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        Accept: "application/json",
      },
      timeout: 5000,
    });

    const kaaEntries = Object.values(msRes.data?.Sites?.KickAssAnime || {}) as any[];
    const slug = kaaEntries[0]?.identifier || null;

    slugCache.set(animeId, { at: Date.now(), slug });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.json({ slug });
  } catch (err: any) {
    console.warn(`[StreamSlug] Failed to resolve MALSync slug for ${animeId}:`, err.message);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json({ slug: null });
  }
});

// GET /api/stream/:animeId/:episode
// Returns MultiStreamResult with all available servers grouped by category ("SUB" and "DUB")
router.get("/:animeId/:episode", async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { animeId, episode } = req.params;
    const forceFresh = req.query.fresh === "true" || req.query.fresh === "1";
    const animeIdNum = parseInt(animeId, 10);
    const episodeNum = parseInt(episode, 10);

    if (isNaN(animeIdNum) || isNaN(episodeNum)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const result = await streamProvider.getMultiStream(animeIdNum, episodeNum, forceFresh);
    res.json(result);
  } catch (error: any) {
    console.error("Stream resolution error:", error.message);
    res.json({
      message: error.message || "Failed to resolve streaming sources.",
      servers: [],
      default: -1,
    });
  }
});

export default router;
