export const config = {
  // Use standard Node.js serverless runtime on AWS Lambda
  // This bypasses Cloudflare cf-worker and Vercel Edge X-Vercel-Id headers!
  maxDuration: 60,
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...CORS_HEADERS,
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  try {
    const queryUrl = req.query?.url || new URL(req.url, `http://${req.headers.host}`).searchParams.get("url");
    if (!queryUrl || typeof queryUrl !== "string") {
      res.writeHead(400, CORS_HEADERS);
      return res.end("Missing target ?url= parameter");
    }

    const targetUrl = new URL(queryUrl);
    const customReferer = req.query?.referer;
    let referer = customReferer || `${targetUrl.origin}/`;

    if (targetUrl.hostname.includes("animeheaven")) {
      referer = "https://animeheaven.me/";
    } else if (targetUrl.hostname.includes("krussdomi") || targetUrl.hostname.endsWith(".xyz")) {
      referer = "https://krussdomi.com/";
    } else if (targetUrl.hostname.includes("vixcloud") || targetUrl.hostname.includes("animeunity")) {
      referer = "https://www.animeunity.to/";
    }

    const extraHeaders: Record<string, string> = {};
    if (targetUrl.hostname.includes("animeheaven")) {
      const hexTokens = targetUrl.search.match(/([a-f0-9]{32})/g);
      if (hexTokens && hexTokens.length > 0) {
        extraHeaders["Cookie"] = `key=${hexTokens[hexTokens.length - 1]}`;
      }
    }

    let rangeHeader = req.headers["range"];
    const isMp4 = targetUrl.pathname.endsWith(".mp4") || targetUrl.pathname.includes("video.mp4");
    if (isMp4 && !rangeHeader) {
      rangeHeader = "bytes=0-";
    }

    const upstreamHeaders: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Referer: referer,
      ...extraHeaders,
    };
    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    const upstream = await fetch(targetUrl.toString(), {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "follow",
    });

    const resHeaders: Record<string, string> = {
      ...CORS_HEADERS,
      "Cache-Control": isMp4 ? "no-store" : "public, max-age=86400",
    };

    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const val = upstream.headers.get(h);
      if (val) resHeaders[h] = val;
    }

    if (isMp4 && !resHeaders["accept-ranges"]) {
      resHeaders["accept-ranges"] = "bytes";
    }

    res.writeHead(upstream.status, resHeaders);

    if (req.method === "HEAD" || !upstream.body) {
      return res.end();
    }

    // Stream the body chunks from Node fetch to client
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err: any) {
    console.error("[VercelNodeStreamProxy] Error:", err);
    if (!res.headersSent) {
      res.writeHead(502, CORS_HEADERS);
    }
    res.end(`Streaming proxy error: ${err.message}`);
  }
}
