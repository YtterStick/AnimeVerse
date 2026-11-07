export const config = {
  runtime: "edge",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

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

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "[::1]" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }
  if (
    /^10\./.test(lower) ||
    /^192\.168\./.test(lower) ||
    /^169\.254\./.test(lower) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
  ) {
    return true;
  }
  return false;
}

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
 * CDNs verified to serve `Access-Control-Allow-Origin: *` without Referer locks.
 * Leaving their video segments direct lets the browser stream straight from the CDN
 * with 0 bytes of proxy bandwidth.
 */
function isDirectCorsSafeSegment(absoluteUrl: string): boolean {
  try {
    const u = new URL(absoluteUrl);
    const host = u.hostname.toLowerCase();
    if (host === "vix-content.net" || host.endsWith(".vix-content.net")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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

function ensureWebVtt(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (normalized.startsWith("WEBVTT")) {
    return stripWatermarkCues(normalized);
  }

  const vttBody = normalized
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2 --> $3.$4")
    .replace(/(\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}),(\d{3})/g, "$1.$2 --> $3.$4");

  return stripWatermarkCues(`WEBVTT\n\n${vttBody}`);
}

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
    const absoluteImgUrl = imgPart.startsWith("http")
      ? imgPart
      : new URL(imgPart, parentBase).toString();
    let proxied = `${proxyBaseUrl}?url=${encodeURIComponent(absoluteImgUrl)}`;
    if (referer) {
      proxied += `&referer=${encodeURIComponent(referer)}`;
    }
    return hash ? `${proxied}#${hash}` : proxied;
  });
}

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

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const absoluteUri = resolveUrl(uri, parentBase);
          return `URI="${buildProxyLink(absoluteUri)}"`;
        });
      }

      const absoluteUrl = resolveUrl(trimmed, parentBase);
      return buildProxyLink(absoluteUrl);
    })
    .join("\n");
}

function resolveRefererForTarget(targetUrl: URL, customReferer?: string): string {
  if (customReferer) return customReferer;

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

  for (const [domain, ref] of Object.entries(refererMap)) {
    if (targetUrl.hostname === domain || targetUrl.hostname.endsWith(`.${domain}`)) {
      return ref;
    }
  }

  if (targetUrl.hostname.endsWith(".xyz") || targetUrl.hostname.includes("krussdomi")) {
    return "https://krussdomi.com/";
  }

  return `${targetUrl.origin}/`;
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

  const baseRange: Record<string, string> = rangeHeader ? { Range: rangeHeader } : {};

  return [
    {
      Referer: referer,
      Origin: refererOrigin,
      "User-Agent": USER_AGENT,
      ...baseRange,
    },
    {
      Referer: referer,
      "User-Agent": USER_AGENT,
      ...baseRange,
    },
    {
      Referer: "https://krussdomi.com/",
      Origin: "https://krussdomi.com",
      "User-Agent": USER_AGENT,
      ...baseRange,
    },
    {
      Referer: `${origin}/`,
      "User-Agent": USER_AGENT,
      ...baseRange,
    },
    {
      "User-Agent": USER_AGENT,
      ...baseRange,
    },
  ];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const rawUrl = reqUrl.searchParams.get("url");
    const audioPref = reqUrl.searchParams.get("audio") || undefined;
    const qualityPref = reqUrl.searchParams.get("quality") || undefined;
    const customReferer = reqUrl.searchParams.get("referer") || undefined;

    if (!rawUrl) {
      return new Response("Missing target URL", { status: 400, headers: CORS_HEADERS });
    }

    const url = sanitizeRemoteUrl(rawUrl);
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return new Response("Invalid target URL", { status: 400, headers: CORS_HEADERS });
    }

    if (
      (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") ||
      isBlockedHost(targetUrl.hostname)
    ) {
      return new Response("Blocked target host", { status: 403, headers: CORS_HEADERS });
    }

    const referer = resolveRefererForTarget(targetUrl, customReferer);
    const isSubtitle = /\.(vtt|srt|ass|ssa)(?:[?#]|$)/i.test(url);
    const isPlaylistUrl =
      !isSubtitle && /(?:\.m3u8(?:[?#]|$)|\/playlist\/)/i.test(url);
    const isMp4 = /video\.mp4|\.mp4(?:[?#]|$)/i.test(url);

    let rangeHeader = req.headers.get("range") || undefined;
    if (isMp4 && !rangeHeader) {
      rangeHeader = "bytes=0-";
    }

    const headerAttempts = buildProxyHeaders(url, referer, rangeHeader);
    let lastStatus = 502;

    for (let i = 0; i < headerAttempts.length; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      let upstream: Response;
      try {
        upstream = await fetch(url, {
          method: req.method === "HEAD" ? "HEAD" : "GET",
          headers: headerAttempts[i],
          redirect: "follow",
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (i < headerAttempts.length - 1) continue;
        throw fetchErr;
      }

      // Clear connect timeout once response headers arrive so body streaming is uninterrupted
      clearTimeout(timeoutId);

      if (!upstream.ok) {
        lastStatus = upstream.status;
        const retryable =
          upstream.status === 403 ||
          upstream.status === 404 ||
          upstream.status === 429 ||
          upstream.status >= 500;
        if (i < headerAttempts.length - 1 && retryable) {
          continue;
        }
        return new Response("Upstream streaming source rejected request", {
          status: upstream.status,
          headers: CORS_HEADERS,
        });
      }

      const upstreamType = (upstream.headers.get("content-type") || "").toLowerCase();

      if (isSubtitle) {
        const rawText = await upstream.text();
        const isThumbnailVtt = /#xywh=|\.(?:jpg|jpeg|png|webp)/i.test(rawText);
        const body = isThumbnailVtt
          ? rewriteThumbnailVtt(rawText, url, "/api/proxy", referer)
          : ensureWebVtt(rawText);

        return new Response(body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/vtt; charset=utf-8",
            "Cache-Control": "public, s-maxage=86400, max-age=86400",
          },
        });
      }

      if (
        isPlaylistUrl ||
        upstreamType.includes("mpegurl") ||
        upstreamType.includes("x-mpegurl")
      ) {
        const rawText = await upstream.text();
        if (rawText.trimStart().startsWith("#EXTM3U")) {
          const rewritten = rewriteM3U8(
            rawText,
            url,
            "/api/proxy",
            audioPref,
            referer,
            qualityPref
          );
          return new Response(rewritten, {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/vnd.apple.mpegurl",
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        }

        return new Response(rawText, {
          status: upstream.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": upstreamType || "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      // Stream binary segments (.ts, .m4s, .jpg), MP4 byte ranges, storyboards, or player HTML
      const isHtml = upstreamType.includes("text/html");
      const isImage =
        /\.(jpg|jpeg|png|webp)(?:[?#]|$)/i.test(url) || upstreamType.startsWith("image/");

      const contentType = isMp4
        ? "video/mp4"
        : isHtml
        ? "text/html; charset=utf-8"
        : isImage
        ? upstreamType.startsWith("image/")
          ? upstreamType
          : "image/jpeg"
        : upstreamType && !upstreamType.includes("image/")
        ? upstreamType
        : "video/mp2t";

      const resHeaders = new Headers(CORS_HEADERS);
      resHeaders.set("Content-Type", contentType);

      if (isMp4 || isHtml) {
        resHeaders.set("Cache-Control", "no-store");
      } else {
        resHeaders.set("Cache-Control", "public, s-maxage=86400, max-age=86400, immutable");
      }

      const contentLength = upstream.headers.get("content-length");
      if (contentLength) {
        resHeaders.set("Content-Length", contentLength);
      }
      const contentRange = upstream.headers.get("content-range");
      if (contentRange) {
        resHeaders.set("Content-Range", contentRange);
      }
      const acceptRanges = upstream.headers.get("accept-ranges");
      if (acceptRanges) {
        resHeaders.set("Accept-Ranges", acceptRanges);
      } else if (isMp4) {
        resHeaders.set("Accept-Ranges", "bytes");
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
      });
    }

    return new Response("Failed to proxy streaming resource", {
      status: lastStatus,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error("[EdgeStreamProxy] Error:", err);
    return new Response("Failed to proxy streaming resource", {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}
