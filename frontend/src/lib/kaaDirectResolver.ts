import type { StreamServer, SubtitleTrack } from "@/types";
import { BACKEND_URL } from "./api";

const decodeHtml = (str: string) => {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
};

const sanitizeUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed.replace(/^\/+/, "//")}`;
  return trimmed
    .replace(/^https?:\/{3,}/i, "https://")
    .replace(/^https:https:\/\//i, "https://")
    .replace(/^http:\/\//i, "https://");
};

const buildProxyUrl = (url: string, audio?: "jpn" | "eng", quality?: string) => {
  const base = BACKEND_URL ? `${BACKEND_URL}/api/stream/proxy` : "/api/stream/proxy";
  let full = `${base}?url=${encodeURIComponent(sanitizeUrl(url))}`;
  if (audio) full += `&audio=${audio}`;
  if (quality) full += `&quality=${encodeURIComponent(quality)}`;
  return full;
};

/**
 * Direct client-side KickAssAnime resolver.
 * kaa.lt has open `Access-Control-Allow-Origin: *` headers, so client browsers
 * (residential IPs) can query it with 0% risk of Cloudflare 403 blocks.
 */
export async function resolveKaaClient(
  animeId: number,
  episodeNum: number
): Promise<StreamServer[]> {
  try {
    // 1. Resolve slug via backend endpoint (avoids browser CORS block on api.malsync.moe)
    const slugApi = BACKEND_URL ? `${BACKEND_URL}/api/stream/slug/${animeId}` : `/api/stream/slug/${animeId}`;
    let slug: string | null = null;
    try {
      const slugRes = await fetch(slugApi, { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      slug = slugRes?.slug || null;
    } catch {
      slug = null;
    }

    if (!slug) {
      // Direct fallback (safe if supported or proxies available)
      const msRes = await fetch(`https://api.malsync.moe/mal/anime/${animeId}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const kaaEntries = Object.values(msRes?.Sites?.KickAssAnime || {}) as any[];
      slug = kaaEntries[0]?.identifier || null;
    }

    if (!slug) return [];

    // 2. Query kaa.lt for episode list (has Access-Control-Allow-Origin: *)
    const epRes = await fetch(
      `https://kaa.lt/api/show/${slug}/episodes?ep=${episodeNum}&lang=ja-JP`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    const epList: any[] = epRes?.result || [];
    const target = epList.find(
      (e) =>
        Math.floor(Number(e.episode_number)) === episodeNum ||
        String(e.episode_string) === String(episodeNum)
    );
    if (!target) return [];

    const epNumStr = target.episode_string || String(Math.floor(Number(target.episode_number)));
    const detailUrl = `https://kaa.lt/api/show/${slug}/episode/ep-${epNumStr}-${target.slug}`;

    const detail = await fetch(detailUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    const epServers: Array<{ name: string; src: string }> = detail?.servers || [];
    if (!epServers.length) return [];

    const servers: StreamServer[] = [];

    for (let i = 0; i < epServers.length; i++) {
      const srv = epServers[i];
      let cleanSrc = sanitizeUrl(srv.src);

      try {
        // Must fetch player HTML via our proxy because krussdomi.com lacks CORS headers for browsers
        const playerHtml = await fetch(buildProxyUrl(cleanSrc), {
          signal: AbortSignal.timeout(7000),
        }).then((r) => r.text());
        const propsMatch = playerHtml.match(/props="([^"]+)"/);
        if (!propsMatch) continue;

        const jsonData = JSON.parse(decodeHtml(propsMatch[1]));
        const rawManifest = jsonData?.manifest?.[1];
        if (!rawManifest) continue;

        const manifestUrl = sanitizeUrl(String(rawManifest));
        const rawSubs = jsonData?.subtitles?.[1] || [];

        const subtitles: SubtitleTrack[] = [];
        for (let j = 0; j < rawSubs.length; j++) {
          const entry = rawSubs[j]?.[1];
          const src = entry?.src?.[1];
          const lang = entry?.language?.[1] || entry?.name?.[1] || "en";
          const label = entry?.name?.[1] || "Subtitle";
          if (src) {
            subtitles.push({
              id: `sub-${lang}-${j}`,
              url: buildProxyUrl(sanitizeUrl(String(src))),
              lang: String(lang),
              label: String(label),
              type: "vtt",
            });
          }
        }

        // Add Auto 1080p
        servers.push({
          id: `kaa-sub-${srv.name.toLowerCase().replace(/\s+/g, "-")}-${i}`,
          name: `${srv.name} (Auto 1080p)`,
          category: "SUB",
          url: buildProxyUrl(manifestUrl, "jpn"),
          type: "hls",
          quality: "1080p",
          subtitles,
        });

        // Add 720p Fast
        servers.push({
          id: `kaa-sub-${srv.name.toLowerCase().replace(/\s+/g, "-")}-720p-${i}`,
          name: `${srv.name} (720p Fast)`,
          category: "SUB",
          url: buildProxyUrl(manifestUrl, "jpn", "720p"),
          type: "hls",
          quality: "720p",
          subtitles,
        });

        // Add 360p Data Saver
        servers.push({
          id: `kaa-sub-${srv.name.toLowerCase().replace(/\s+/g, "-")}-360p-${i}`,
          name: `${srv.name} (360p Data Saver)`,
          category: "SUB",
          url: buildProxyUrl(manifestUrl, "jpn", "360p"),
          type: "hls",
          quality: "360p",
          subtitles,
        });
      } catch (err: any) {
        console.warn(`[KaaDirectResolver] Failed to parse player for ${srv.name}:`, err.message);
      }
    }

    // 3. Also check for English DUB servers (en-US locale)
    try {
      const dubEpRes = await fetch(
        `https://kaa.lt/api/show/${slug}/episodes?ep=${episodeNum}&lang=en-US`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) }
      ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

      const dubEpList: any[] = dubEpRes?.result || [];
      const dubTarget = dubEpList.find(
        (e) =>
          Math.floor(Number(e.episode_number)) === episodeNum ||
          String(e.episode_string) === String(episodeNum)
      );
      if (dubTarget) {
        const epNumStr = dubTarget.episode_string || String(Math.floor(Number(dubTarget.episode_number)));
        const dubDetail = await fetch(
          `https://kaa.lt/api/show/${slug}/episode/ep-${epNumStr}-${dubTarget.slug}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
        ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

        const dubServers: Array<{ name: string; src: string }> = dubDetail?.servers || [];
        for (let i = 0; i < dubServers.length; i++) {
          const srv = dubServers[i];
          try {
            const playerHtml = await fetch(buildProxyUrl(sanitizeUrl(srv.src)), {
              signal: AbortSignal.timeout(6000),
            }).then((r) => r.text());
            const propsMatch = playerHtml.match(/props="([^"]+)"/);
            if (!propsMatch) continue;
            const jsonData = JSON.parse(decodeHtml(propsMatch[1]));
            const rawManifest = jsonData?.manifest?.[1];
            if (!rawManifest) continue;
            const manifestUrl = sanitizeUrl(String(rawManifest));

            servers.push({
              id: `kaa-dub-${srv.name.toLowerCase().replace(/\s+/g, "-")}-${i}`,
              name: `${srv.name} Dub (Auto 1080p)`,
              category: "DUB",
              url: buildProxyUrl(manifestUrl, "eng"),
              type: "hls",
              quality: "1080p",
              subtitles: [],
            });
          } catch {
            // Ignore individual server error
          }
        }
      }
    } catch {
      // Continue without DUB
    }

    return servers;
  } catch (err: any) {
    console.warn("[KaaDirectResolver] Fallback error:", err.message);
    return [];
  }
}

