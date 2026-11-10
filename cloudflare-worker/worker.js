import { connect } from "cloudflare:sockets";

/**
 * AniVerse Cloudflare Streaming Worker
 * Proxies video streams, MP4s, HLS playlists (.m3u8), and subtitles (.vtt)
 * with 100% UNLIMITED bandwidth, zero buffering, and 0 MB used on Render or Vercel.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

function resolveReferer(targetUrl, customReferer) {
  if (customReferer) return customReferer;
  const host = targetUrl.hostname.toLowerCase();
  if (host.includes("animeheaven")) return "https://animeheaven.me/";
  if (host.includes("krussdomi") || host.endsWith(".xyz")) return "https://krussdomi.com/";
  if (host.includes("vixcloud") || host.includes("animeunity")) return "https://www.animeunity.to/";
  return `${targetUrl.origin}/`;
}

function rewriteM3U8(content, parentUrl, workerOrigin, referer) {
  const parentBase = parentUrl.substring(0, parentUrl.lastIndexOf("/") + 1);
  return content
    .replace(/^(?!#)(.+)$/gm, (line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      let absolute;
      try {
        absolute = new URL(trimmed, parentBase).toString();
      } catch {
        absolute = trimmed;
      }
      return `${workerOrigin}/?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}`;
    })
    .replace(/URI="([^"]+)"/g, (_match, uri) => {
      let absolute;
      try {
        absolute = new URL(uri, parentBase).toString();
      } catch {
        absolute = uri;
      }
      return `URI="${workerOrigin}/?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}"`;
    });
}

/**
 * Connects directly via raw TLS socket to bypass Cloudflare's automatic
 * 'Cf-Worker' header injection, allowing AnimeHeaven MP4s to serve the full 1080p video.
 */
async function fetchDirectSocket(targetUrl, headers) {
  const u = new URL(targetUrl);
  const socket = connect({ hostname: u.hostname, port: 443 }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();

  let req = `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
    `Host: ${u.hostname}\r\n`;
  for (const [k, v] of Object.entries(headers)) {
    req += `${k}: ${v}\r\n`;
  }
  req += `Connection: close\r\n\r\n`;

  await writer.write(new TextEncoder().encode(req));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(0);
  let parsed = false;
  let status = 200;
  const resHeaders = new Headers();

  while (!parsed) {
    const { done, value } = await reader.read();
    if (done) break;

    const newBuf = new Uint8Array(buffer.length + value.length);
    newBuf.set(buffer);
    newBuf.set(value, buffer.length);
    buffer = newBuf;

    for (let i = 0; i <= buffer.length - 4; i++) {
      if (
        buffer[i] === 13 &&
        buffer[i + 1] === 10 &&
        buffer[i + 2] === 13 &&
        buffer[i + 3] === 10
      ) {
        parsed = true;
        const headerText = decoder.decode(buffer.subarray(0, i));
        const lines = headerText.split("\r\n");
        status = parseInt(lines[0].split(" ")[1], 10) || 200;
        for (let j = 1; j < lines.length; j++) {
          const sep = lines[j].indexOf(":");
          if (sep !== -1) {
            const k = lines[j].slice(0, sep).trim().toLowerCase();
            const v = lines[j].slice(sep + 1).trim();
            resHeaders.set(k, v);
          }
        }
        const bodyRemaining = buffer.subarray(i + 4);

        const bodyStream = new ReadableStream({
          async start(controller) {
            if (bodyRemaining.length > 0) {
              controller.enqueue(bodyRemaining);
            }
          },
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          },
          cancel() {
            reader.cancel();
          },
        });

        return { status, headers: resHeaders, body: bodyStream };
      }
    }
  }

  throw new Error("Incomplete HTTP response from upstream socket");
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
      const rawTarget = reqUrl.searchParams.get("url");

      if (!rawTarget) {
        return new Response("AniVerse Cloudflare Stream Proxy: Ready. Provide ?url= parameter.", {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
        });
      }

      let targetUrl;
      try {
        targetUrl = new URL(rawTarget.trim());
      } catch {
        return new Response("Invalid target URL", { status: 400, headers: CORS_HEADERS });
      }

      const customReferer = reqUrl.searchParams.get("referer") || undefined;
      const referer = resolveReferer(targetUrl, customReferer);

      const extraHeaders = {};
      const isAnimeHeaven = targetUrl.hostname.includes("animeheaven");
      if (isAnimeHeaven) {
        const hexTokens = targetUrl.search.match(/([a-f0-9]{32})/g);
        if (hexTokens && hexTokens.length > 0) {
          extraHeaders["Cookie"] = `key=${hexTokens[hexTokens.length - 1]}`;
        }
      }

      let rangeHeader = request.headers.get("range");
      const isMp4 = targetUrl.pathname.endsWith(".mp4") || targetUrl.pathname.includes("video.mp4");
      if (isMp4 && !rangeHeader) {
        rangeHeader = "bytes=0-";
      }

      const upstreamHeaders = {
        "User-Agent": USER_AGENT,
        Referer: referer,
        ...extraHeaders,
      };
      if (rangeHeader) {
        upstreamHeaders["Range"] = rangeHeader;
      }

      // If AnimeHeaven, use direct TLS socket to avoid Cf-Worker injection
      if (isAnimeHeaven) {
        const socketRes = await fetchDirectSocket(targetUrl.toString(), upstreamHeaders);
        const resHeaders = new Headers(CORS_HEADERS);
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const val = socketRes.headers.get(h);
          if (val) resHeaders.set(h, val);
        }
        if (!resHeaders.has("accept-ranges")) {
          resHeaders.set("accept-ranges", "bytes");
        }
        resHeaders.set("Cache-Control", "public, max-age=86400");

        return new Response(socketRes.body, {
          status: socketRes.status,
          headers: resHeaders,
        });
      }

      // For all other providers (HLS, M3U8, subtitles), standard fetch
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        headers: upstreamHeaders,
        redirect: "follow",
      });

      const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
      const isPlaylist =
        targetUrl.pathname.endsWith(".m3u8") ||
        contentType.includes("mpegurl") ||
        contentType.includes("x-mpegurl");

      if (isPlaylist) {
        const rawText = await upstream.text();
        const rewritten = rewriteM3U8(rawText, targetUrl.href, reqUrl.origin, referer);
        return new Response(rewritten, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      const resHeaders = new Headers(CORS_HEADERS);
      for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const val = upstream.headers.get(h);
        if (val) resHeaders.set(h, val);
      }

      if (isMp4 && !resHeaders.has("accept-ranges")) {
        resHeaders.set("accept-ranges", "bytes");
      }
      resHeaders.set("Cache-Control", "public, max-age=86400");

      return new Response(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
      });
    } catch (err) {
      return new Response(`Cloudflare Streaming Proxy error: ${err.message}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
  },
};
