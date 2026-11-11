import { connect } from "cloudflare:sockets";

/**
 * AniVerse Cloudflare Streaming Worker
 * Proxies video streams, MP4s, HLS playlists (.m3u8), storyboards, and subtitles (.vtt/.srt)
 * with 100% unlimited Cloudflare Worker bandwidth and 0 MB used on Vercel/Render.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

const RENDER_STREAM_PROXY = "https://animeverse-z6p4.onrender.com/api/stream/proxy";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

function sanitizeRemoteUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed.replace(/^\/+/, "//")}`;
  }
  return trimmed
    .replace(/^https?:\/{3,}/i, "https://")
    .replace(/^https:https:\/\//i, "https://")
    .replace(/^http:\/\//i, "https://");
}

function isBlockedHost(hostname) {
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

function resolveUrl(url, base) {
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
 * CDNs verified to serve Access-Control-Allow-Origin: * without Referer locks.
 * Leaving their video segments direct lets the browser stream straight from the CDN.
 */
function isDirectCorsSafeSegment(absoluteUrl) {
  try {
    const u = new URL(absoluteUrl);
    const host = u.hostname.toLowerCase();
    return host === "vix-content.net" || host.endsWith(".vix-content.net");
  } catch {
    return false;
  }
}

function stripWatermarkCues(vtt) {
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

function ensureWebVtt(content) {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (normalized.startsWith("WEBVTT")) {
    return stripWatermarkCues(normalized);
  }

  const vttBody = normalized
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2 --> $3.$4")
    .replace(/(\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}),(\d{3})/g, "$1.$2 --> $3.$4");

  return stripWatermarkCues(`WEBVTT\n\n${vttBody}`);
}

function rewriteThumbnailVtt(content, parentUrl, proxyBaseUrl, referer) {
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

function rewriteM3U8(content, parentUrl, proxyBaseUrl, audioPref, customReferer, qualityPref) {
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
        const filteredLines = [];
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

  const buildProxyLink = (targetUrl) => {
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
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUri = resolveUrl(uri, parentBase);
          return `URI="${buildProxyLink(absoluteUri)}"`;
        });
      }

      const absoluteUrl = resolveUrl(trimmed, parentBase);
      return buildProxyLink(absoluteUrl);
    })
    .join("\n");
}

function resolveRefererForTarget(targetUrl, customReferer) {
  if (customReferer) return customReferer;

  const refererMap = {
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

function buildProxyHeaders(targetUrl, referer, rangeHeader) {
  const origin = targetUrl.origin;
  const refererOrigin = (() => {
    try {
      return new URL(referer).origin;
    } catch {
      return referer;
    }
  })();

  const baseRange = rangeHeader ? { Range: rangeHeader } : {};

  // AnimeHeaven requires Cookie: key=<token> extracted from query params
  const extraHeaders = {};
  if (targetUrl.hostname.includes("animeheaven")) {
    const hexTokens = targetUrl.search.match(/([a-f0-9]{32})/g);
    if (hexTokens && hexTokens.length > 0) {
      extraHeaders["Cookie"] = `key=${hexTokens[hexTokens.length - 1]}`;
    }
  }

  return [
    {
      Referer: referer,
      Origin: refererOrigin,
      "User-Agent": USER_AGENT,
      ...extraHeaders,
      ...baseRange,
    },
    {
      Referer: referer,
      "User-Agent": USER_AGENT,
      ...extraHeaders,
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
      ...extraHeaders,
      ...baseRange,
    },
    {
      "User-Agent": USER_AGENT,
      ...extraHeaders,
      ...baseRange,
    },
  ];
}

function concatBytes(a, b) {
  if (!a.length) return b;
  if (!b.length) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function findCrlf(buf, start = 0) {
  for (let i = start; i <= buf.length - 2; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10) return i;
  }
  return -1;
}

function findDoubleCrlf(buf) {
  for (let i = 0; i <= buf.length - 4; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
      return i;
    }
  }
  return -1;
}

/**
 * Decodes an HTTP/1.1 Transfer-Encoding: chunked socket body into clean raw bytes.
 */
function createChunkedBodyStream(initialBytes, reader) {
  const decoder = new TextDecoder();
  let buf = initialBytes;
  let remainingInChunk = -1;
  let expectTrailingCrlf = false;

  return new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          if (expectTrailingCrlf) {
            if (buf.length < 2) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              buf = concatBytes(buf, value);
              continue;
            }
            buf = buf.subarray(2);
            expectTrailingCrlf = false;
          }

          if (remainingInChunk === -1) {
            const crlfIdx = findCrlf(buf);
            if (crlfIdx === -1) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              buf = concatBytes(buf, value);
              continue;
            }

            const sizeLine = decoder.decode(buf.subarray(0, crlfIdx)).split(";")[0].trim();
            buf = buf.subarray(crlfIdx + 2);
            const size = parseInt(sizeLine, 16);
            if (Number.isNaN(size) || size < 0) {
              controller.error(new Error(`Invalid HTTP chunk size: ${sizeLine}`));
              await reader.cancel().catch(() => {});
              return;
            }
            if (size === 0) {
              controller.close();
              await reader.cancel().catch(() => {});
              return;
            }
            remainingInChunk = size;
          }

          if (buf.length > 0 && remainingInChunk > 0) {
            const take = Math.min(buf.length, remainingInChunk);
            controller.enqueue(buf.subarray(0, take));
            buf = buf.subarray(take);
            remainingInChunk -= take;
            if (remainingInChunk === 0) {
              remainingInChunk = -1;
              expectTrailingCrlf = true;
            }
            return;
          }

          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buf = concatBytes(buf, value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

/**
 * Connects directly via raw TLS socket to bypass Cloudflare's automatic
 * 'Cf-Worker' header injection when needed (e.g., AnimeHeaven or WAF blocks).
 */
async function fetchDirectSocket(targetUrl, headers, method = "GET", redirectsLeft = 4) {
  const u = new URL(targetUrl);
  const isHttps = u.protocol === "https:";
  const port = u.port ? parseInt(u.port, 10) : isHttps ? 443 : 80;

  const socket = connect(
    { hostname: u.hostname, port },
    { secureTransport: isHttps ? "on" : "off" }
  );
  const writer = socket.writable.getWriter();

  const path = `${u.pathname || "/"}${u.search}`;
  let req = `${method} ${path} HTTP/1.1\r\nHost: ${u.host}\r\n`;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "host" || k.toLowerCase() === "accept-encoding") continue;
    req += `${k}: ${v}\r\n`;
  }
  req += `Accept-Encoding: identity\r\nConnection: close\r\n\r\n`;

  await writer.write(new TextEncoder().encode(req));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(0);

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer = concatBytes(buffer, value);
    }

    const headerEnd = findDoubleCrlf(buffer);
    if (headerEnd !== -1) {
      const headerText = decoder.decode(buffer.subarray(0, headerEnd));
      const lines = headerText.split("\r\n");
      const status = parseInt(lines[0].split(" ")[1], 10) || 200;
      const resHeaders = new Headers();
      for (let j = 1; j < lines.length; j++) {
        const sep = lines[j].indexOf(":");
        if (sep !== -1) {
          const k = lines[j].slice(0, sep).trim().toLowerCase();
          const v = lines[j].slice(sep + 1).trim();
          resHeaders.set(k, v);
        }
      }

      const location = resHeaders.get("location");
      if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
        await reader.cancel().catch(() => {});
        const nextUrl = new URL(location, u).toString();
        return fetchDirectSocket(nextUrl, headers, method, redirectsLeft - 1);
      }

      if (method === "HEAD") {
        await reader.cancel().catch(() => {});
        return {
          status,
          ok: status >= 200 && status < 300,
          headers: resHeaders,
          body: null,
          text: async () => "",
        };
      }

      const bodyRemaining = buffer.subarray(headerEnd + 4);
      const isChunked = (resHeaders.get("transfer-encoding") || "").toLowerCase().includes("chunked");

      const bodyStream = isChunked
        ? createChunkedBodyStream(bodyRemaining, reader)
        : new ReadableStream({
            start(controller) {
              if (bodyRemaining.length > 0) {
                controller.enqueue(bodyRemaining);
              }
            },
            async pull(controller) {
              try {
                const { done: streamDone, value: chunk } = await reader.read();
                if (streamDone) {
                  controller.close();
                } else {
                  controller.enqueue(chunk);
                }
              } catch (err) {
                controller.error(err);
              }
            },
            cancel() {
              reader.cancel().catch(() => {});
            },
          });

      if (isChunked) {
        resHeaders.delete("transfer-encoding");
      }

      return {
        status,
        ok: status >= 200 && status < 300,
        headers: resHeaders,
        body: bodyStream,
        text: () => new Response(bodyStream).text(),
      };
    }

    if (done || buffer.length > 65536) {
      await reader.cancel().catch(() => {});
      throw new Error("Incomplete or oversized HTTP response headers from socket");
    }
  }
}

function parseTotalBytesFromHeaders(headers, status) {
  const contentRange = headers.get("content-range") || "";
  const rangeMatch = contentRange.match(/\/(\d+)$/);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10) || 0;
  }
  if (status === 200) {
    return parseInt(headers.get("content-length") || "", 10) || 0;
  }
  return 0;
}

async function formatProxiedResponse({
  upstream,
  url,
  workerProxyBase,
  referer,
  audioPref,
  qualityPref,
  isSubtitle,
  isPlaylistUrl,
  isMp4,
}) {
  const upstreamType = (upstream.headers.get("content-type") || "").toLowerCase();

  if (isSubtitle) {
    const rawText = await upstream.text();
    const isThumbnailVtt = /#xywh=|\.(?:jpg|jpeg|png|webp)/i.test(rawText);
    const body = isThumbnailVtt
      ? rewriteThumbnailVtt(rawText, url, workerProxyBase, referer)
      : ensureWebVtt(rawText);

    return new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
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
        workerProxyBase,
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

  const isHtml = upstreamType.includes("text/html");
  const isJson = upstreamType.includes("application/json");
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

  if (isMp4 || isHtml || isJson) {
    resHeaders.set("Cache-Control", "no-store");
  } else {
    resHeaders.set("Cache-Control", "public, max-age=86400, immutable");
  }

  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const val = upstream.headers.get(h);
    if (val) resHeaders.set(h, val);
  }
  if (isMp4 && !resHeaders.has("accept-ranges")) {
    resHeaders.set("Accept-Ranges", "bytes");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    try {
      const reqUrl = new URL(request.url);
      const rawUrl = reqUrl.searchParams.get("url");

      if (!rawUrl) {
        return new Response("AniVerse Cloudflare Stream Proxy: Ready. Provide ?url= parameter.", {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const audioPref = reqUrl.searchParams.get("audio") || undefined;
      const qualityPref = reqUrl.searchParams.get("quality") || undefined;
      const customReferer = reqUrl.searchParams.get("referer") || undefined;

      const url = sanitizeRemoteUrl(rawUrl);
      let targetUrl;
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

      const method = request.method === "HEAD" ? "HEAD" : "GET";
      const workerProxyBase = `${reqUrl.origin}/`;
      const referer = resolveRefererForTarget(targetUrl, customReferer);
      const isAnimeHeaven = targetUrl.hostname.toLowerCase().includes("animeheaven");
      const isSubtitle = /\.(vtt|srt|ass|ssa)(?:[?#]|$)/i.test(url);
      const isPlaylistUrl = !isSubtitle && /(?:\.m3u8(?:[?#]|$)|\/playlist\/)/i.test(url);
      const isMp4 = /video\.mp4|\.mp4(?:[?#]|$)/i.test(url);

      let rangeHeader = request.headers.get("range") || undefined;
      if (isMp4 && !rangeHeader) {
        rangeHeader = "bytes=0-";
      }

      const headerAttempts = buildProxyHeaders(targetUrl, referer, rangeHeader);

      // AnimeHeaven blocks standard fetch() with Cf-Worker (capping video to a 600 KB teaser).
      // Connect via raw TLS socket first, and fallback via 307 to Render if blocked or capped.
      if (isAnimeHeaven) {
        try {
          const socketRes = await fetchDirectSocket(url, headerAttempts[0], method);
          const totalBytes = parseTotalBytesFromHeaders(socketRes.headers, socketRes.status);
          const isTeaserClip = isMp4 && totalBytes > 0 && totalBytes < 2_000_000;

          if (socketRes.ok && !isTeaserClip) {
            return formatProxiedResponse({
              upstream: socketRes,
              url,
              workerProxyBase,
              referer,
              audioPref,
              qualityPref,
              isSubtitle,
              isPlaylistUrl,
              isMp4,
            });
          }

          await socketRes.body?.cancel?.().catch(() => {});
        } catch {
          // Fall through to Render fallback
        }

        const renderFallbackUrl = `${RENDER_STREAM_PROXY}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
        return new Response(null, {
          status: 307,
          headers: {
            ...CORS_HEADERS,
            Location: renderFallbackUrl,
            "Cache-Control": "no-store",
          },
        });
      }

      // Standard fetch() ladder (attempt 1 sends BOTH Referer and Origin, which krussdomi/advancedairesearchlab requires)
      let lastStatus = 502;
      for (let i = 0; i < headerAttempts.length; i++) {
        let upstream;
        try {
          upstream = await fetch(url, {
            method,
            headers: headerAttempts[i],
            redirect: "follow",
            signal: AbortSignal.timeout(18000),
          });
        } catch {
          if (i < headerAttempts.length - 1) continue;
          throw new Error("Upstream fetch failed");
        }

        if (!upstream.ok) {
          lastStatus = upstream.status;
          await upstream.body?.cancel?.().catch(() => {});
          const retryable =
            upstream.status === 403 ||
            upstream.status === 404 ||
            upstream.status === 429 ||
            upstream.status >= 500;
          if (i < headerAttempts.length - 1 && retryable) {
            continue;
          }
          break;
        }

        return formatProxiedResponse({
          upstream,
          url,
          workerProxyBase,
          referer,
          audioPref,
          qualityPref,
          isSubtitle,
          isPlaylistUrl,
          isMp4,
        });
      }

      // Final socket fallback if fetch() returned 403 due to Cf-Worker header rejection
      if (lastStatus === 403) {
        try {
          const socketRes = await fetchDirectSocket(url, headerAttempts[0], method);
          if (socketRes.ok) {
            return formatProxiedResponse({
              upstream: socketRes,
              url,
              workerProxyBase,
              referer,
              audioPref,
              qualityPref,
              isSubtitle,
              isPlaylistUrl,
              isMp4,
            });
          }
          lastStatus = socketRes.status || lastStatus;
          await socketRes.body?.cancel?.().catch(() => {});
        } catch {
          // Ignore socket error (e.g. restricted Cloudflare proxy IP) and return upstream status
        }
      }

      return new Response("Upstream streaming source rejected request", {
        status: lastStatus,
        headers: CORS_HEADERS,
      });
    } catch (err) {
      return new Response(`Cloudflare Streaming Proxy error: ${err?.message || "Unknown error"}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
  },
};
