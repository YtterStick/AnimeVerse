import type { StreamServer, SubtitleTrack } from "@/types";

export interface ZokoResolverOptions {
  buildProxyUrls: (targetUrl: string, referer?: string) => string[];
  buildStreamProxyUrl: (targetUrl: string, referer?: string) => string;
  fresh?: boolean;
}

interface ZokoRawSubtitle {
  lang?: string;
  label?: string;
  default?: boolean;
  src?: string;
  url?: string;
}

export interface ZokoEmbedPayload {
  src?: string;
  subtitles?: ZokoRawSubtitle[];
  skip?: {
    intro?: { start?: number; end?: number } | null;
    outro?: { start?: number; end?: number } | null;
  } | null;
}

const ZOKO_XOR_KEY = "otaku-embed-v1";
const ZOKO_PARENT_REFERER = "https://hianime.at/";
const ZOKO_MEDIA_REFERER = "https://zokoanime.video/";
const REQUEST_TIMEOUT_MS = 8500;
const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_CACHE_ENTRIES = 30;

const serverCache = new Map<string, { expiresAt: number; servers: StreamServer[] }>();
const inFlightRequests = new Map<string, Promise<StreamServer[]>>();

function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed.replace(/^\/+/, "//")}`;
  }
  return trimmed
    .replace(/^https?:\/{3,}/i, "https://")
    .replace(/^https:https:\/\//i, "https://")
    .replace(/^http:\/\//i, "https://");
}

/** Extract the encoded `window.__P="..."` blob from a ZokoAnime embed HTML response. */
export function extractZokoBlob(html: string): string | null {
  const match = html.match(/window\.__P\s*=\s*"([^"]+)"/);
  return match?.[1] || null;
}

/** Decode base64 XOR-obfuscated `window.__P` JSON payload from ZokoAnime. */
export function deobfuscateZokoPayload(encoded: string): ZokoEmbedPayload | null {
  try {
    const clean = encoded.trim();
    if (!clean) return null;

    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i) ^ ZOKO_XOR_KEY.charCodeAt(i % ZOKO_XOR_KEY.length);
    }

    const decoded = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Clean noisy ZokoAnime subtitle track labels (e.g. "English (English - Dialog - (SRT))"). */
export function formatZokoSubtitleLabel(rawLabel?: string, lang?: string): string {
  const trimmed = (rawLabel || "").trim();
  const isEnglish =
    (lang || "").toLowerCase().startsWith("en") || /\benglish\b/i.test(trimmed);

  if (isEnglish) {
    if (/signs\s*&?\s*songs/i.test(trimmed)) return "English (Signs & Songs)";
    return "English";
  }

  return (
    trimmed
      .replace(/\s*\((?:SRT|ASS|VTT)\)\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim() || (lang ? lang.toUpperCase() : "Subtitles")
  );
}

function normalizeZokoSubtitles(
  rawSubs: ZokoRawSubtitle[] | undefined,
  options: ZokoResolverOptions
): SubtitleTrack[] {
  if (!Array.isArray(rawSubs)) return [];

  const scored: Array<{ track: SubtitleTrack; priority: number }> = [];
  for (let i = 0; i < rawSubs.length; i++) {
    const raw = rawSubs[i];
    const subUrl = sanitizeUrl(raw?.src || raw?.url || "");
    if (!subUrl || !subUrl.startsWith("http")) continue;

    const lang = (raw.lang || "en").trim().toLowerCase();
    const label = formatZokoSubtitleLabel(raw.label, lang);
    const isSigns = /signs\s*&?\s*songs/i.test(label);
    const isEnglish = lang.startsWith("en") || /^english/i.test(label);

    let priority = 0;
    if (isEnglish && !isSigns) priority += 100;
    else if (isEnglish) priority += 40;
    if (raw.default && !isSigns) priority += 20;

    scored.push({
      priority,
      track: {
        id: `zoko-sub-track-${i}`,
        url: options.buildStreamProxyUrl(subUrl, ZOKO_MEDIA_REFERER),
        label,
        lang: isEnglish ? "en" : lang || "en",
        type: "vtt",
      },
    });
  }

  scored.sort((a, b) => b.priority - a.priority);
  return scored.map((item) => item.track);
}

async function fetchZokoCategory(
  animeId: number,
  episodeNum: number,
  category: "SUB" | "DUB",
  options: ZokoResolverOptions
): Promise<StreamServer | null> {
  const mode = category === "DUB" ? "dub" : "sub";
  const embedUrl = `https://zokoanime.video/stream/mal/${animeId}/${episodeNum}/${mode}`;
  const candidates = options.buildProxyUrls(embedUrl, ZOKO_PARENT_REFERER);

  for (const proxyUrl of candidates) {
    try {
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const blob = extractZokoBlob(html);
      if (!blob) continue;

      const payload = deobfuscateZokoPayload(blob);
      const streamUrl = sanitizeUrl(payload?.src || "");
      if (!streamUrl || !streamUrl.startsWith("http")) continue;

      return {
        id: `zoko-${mode}-0`,
        name: "Mirage HD",
        category,
        url: options.buildStreamProxyUrl(streamUrl, ZOKO_MEDIA_REFERER),
        type: "hls",
        quality: "Auto",
        subtitles: normalizeZokoSubtitles(payload?.subtitles, options),
      };
    } catch {
      // Try next proxy candidate
    }
  }

  return null;
}

function storeCachedServers(cacheKey: string, servers: StreamServer[]): void {
  if (servers.length === 0) return;

  if (serverCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = serverCache.keys().next().value;
    if (oldestKey) serverCache.delete(oldestKey);
  }

  serverCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    servers,
  });
}

/**
 * Resolves clean non-hardsubbed HLS streams (with native English WebVTT subtitles & English DUB)
 * from ZokoAnime by MyAnimeList ID via the edge stream proxy.
 */
export async function resolveZokoClient(
  animeId: number,
  episodeNum: number,
  options: ZokoResolverOptions
): Promise<StreamServer[]> {
  if (!animeId || animeId <= 0 || !episodeNum || episodeNum <= 0) return [];

  const cacheKey = `${animeId}:${episodeNum}`;
  if (!options.fresh) {
    const cached = serverCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.servers;
    }
    const existing = inFlightRequests.get(cacheKey);
    if (existing) return existing;
  }

  const task = Promise.all([
    fetchZokoCategory(animeId, episodeNum, "SUB", options),
    fetchZokoCategory(animeId, episodeNum, "DUB", options),
  ])
    .then(([subServer, dubServer]) => {
      const resolved = [subServer, dubServer].filter(
        (s): s is StreamServer => Boolean(s)
      );
      storeCachedServers(cacheKey, resolved);
      return resolved;
    })
    .catch(() => [] as StreamServer[])
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  if (!options.fresh) {
    inFlightRequests.set(cacheKey, task);
  }
  return task;
}
