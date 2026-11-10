/**
 * AniVerse Cloudflare Streaming Worker
 * 
 * Proxies video streams, HLS playlists (.m3u8), and subtitles (.vtt)
 * with 100% UNLIMITED bandwidth, zero buffering, and zero impact on Render or Vercel.
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

export default {
  async fetch(request) {
    // 1. Handle CORS Preflight
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

      // 2. Resolve Referer and anti-bot headers
      const customReferer = reqUrl.searchParams.get("referer") || undefined;
      const referer = resolveReferer(targetUrl, customReferer);

      const extraHeaders = {};
      // AnimeHeaven (ct/rx.animeheaven.me) requires Cookie: key=<hex_token>
      if (targetUrl.hostname.includes("animeheaven")) {
        const hexTokens = targetUrl.search.match(/([a-f0-9]{32})/g);
        if (hexTokens && hexTokens.length > 0) {
          extraHeaders["Cookie"] = `key=${hexTokens[hexTokens.length - 1]}`;
        }
      }

      // Forward Range request (essential for video timeline scrubbing & partial downloads)
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

      // 3. Fetch from upstream CDN
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

      // 4. Handle HLS playlist rewriting
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

      // 5. Stream video chunks / audio / subtitles directly to browser
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

