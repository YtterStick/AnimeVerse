import * as xzDecompress from "xz-decompress";
import type { SubtitleTrack } from "@/types";

const XzStream =
  xzDecompress.XzReadableStream ||
  (xzDecompress as { default?: { XzReadableStream?: typeof xzDecompress.XzReadableStream } }).default
    ?.XzReadableStream;

export interface SubtitleResolverOptions {
  buildProxyUrls: (targetUrl: string, referer?: string) => string[];
}

interface ToshoAttachment {
  id?: number;
  type?: string;
  url?: string;
  info?: {
    default?: boolean;
    forced?: boolean;
    format?: string;
    language?: string;
    language_code?: string;
    name?: string;
  };
}

interface ToshoFile {
  filename?: string;
  attachments?: ToshoAttachment[];
}

interface ToshoFeedItem {
  id: number;
  title?: string;
  status?: string;
  anidb_eid?: number | null;
  num_files?: number;
}

const REQUEST_TIMEOUT_MS = 5000;
const RESOLVE_DEADLINE_MS = 9000;
const MAX_CACHED_BLOBS = 30;
const SUBTITLE_TEXT_FORMATS = new Set(["SRT", "ASS", "SSA", "VTT"]);

const anidbIdCache = new Map<number, number | null>();
const toshoFeedCache = new Map<number, ToshoFeedItem[]>();
const torrentFilesCache = new Map<number, ToshoFile[]>();
const subtitleBlobCache = new Map<string, SubtitleTrack[]>();
const inFlightRequests = new Map<string, Promise<SubtitleTrack[]>>();

/** Fetch JSON from the first responding candidate URL. */
async function fetchFirstJson(candidates: string[]): Promise<any | null> {
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // Try next route
    }
  }
  return null;
}

/** Fetch JSON directly when CORS allows, falling back through configured proxy URLs if blocked or DNS-filtered. */
async function fetchJsonWithFallback(
  url: string,
  options: SubtitleResolverOptions,
  allowProxyFallback = true
): Promise<any | null> {
  const candidates = allowProxyFallback
    ? [url, ...options.buildProxyUrls(url)]
    : [url];
  return fetchFirstJson(candidates);
}

function toPositiveId(raw: unknown): number | null {
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Resolve AniDB anime ID from a MyAnimeList ID by racing direct ani.zip and MalSync first. */
async function resolveAniDbId(
  malId: number,
  options: SubtitleResolverOptions
): Promise<number | null> {
  if (anidbIdCache.has(malId)) {
    return anidbIdCache.get(malId) ?? null;
  }

  const aniZipUrl = `https://api.ani.zip/mappings?mal_id=${malId}`;
  const directAniZip = fetchJsonWithFallback(aniZipUrl, options, false).then((data) =>
    toPositiveId(data?.mappings?.anidb_id)
  );

  // MalSync blocks Cloudflare Worker IPs (1106), so only try direct browser fetch.
  const directMalSync = fetchJsonWithFallback(
    `https://api.malsync.moe/mal/anime/${malId}`,
    options,
    false
  ).then((data) => toPositiveId(data?.anidbId));

  const directAid = await new Promise<number | null>((resolve) => {
    let settled = 0;
    const onResult = (aid: number | null) => {
      if (aid !== null) {
        resolve(aid);
        return;
      }
      settled += 1;
      if (settled === 2) resolve(null);
    };
    void directAniZip.then(onResult, () => onResult(null));
    void directMalSync.then(onResult, () => onResult(null));
  });

  if (directAid !== null) {
    anidbIdCache.set(malId, directAid);
    return directAid;
  }

  // Only fall back to Worker-proxied ani.zip when both direct requests fail.
  const proxiedAniZip = await fetchFirstJson(options.buildProxyUrls(aniZipUrl));
  const resolved = toPositiveId(proxiedAniZip?.mappings?.anidb_id);
  anidbIdCache.set(malId, resolved);
  return resolved;
}

/** Extract an episode number from typical anime release filenames while ignoring codecs/resolutions/CRC hashes. */
export function extractEpisodeNumber(filename: string): number | null {
  if (!filename) return null;
  const baseName = filename.split("/").pop() || filename;
  if (/\b(?:ncop|nced|creditless|preview|promo|trailer|menu)\b/i.test(baseName)) {
    return null;
  }

  // Strip extension and bracketed metadata ([1080p], [4563A986], (DVD)) before matching episode tokens
  const noExt = baseName.replace(/\.[a-z0-9]{2,4}$/i, "");
  const seasonEp = noExt.match(/\bS\d{1,2}E(\d{1,4})(?!\d)/i);
  if (seasonEp) return parseInt(seasonEp[1], 10);

  const epWord = noExt.match(/(?:^|[\s._\-\[\(])(?:EP?|Episode)\.?\s*(\d{1,4})(?:v\d)?(?=$|[\s._\-\]\),])/i);
  if (epWord) return parseInt(epWord[1], 10);

  const cleaned = noExt
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b\d{3,4}p\b/gi, " ");

  const dashEp = cleaned.match(/\s-\s(\d{1,4})(?:v\d)?(?=$|[\s._\-])/);
  if (dashEp) return parseInt(dashEp[1], 10);

  const trailingEp = cleaned.match(/[\s._](\d{1,4})(?:v\d)?\s*$/);
  if (trailingEp) return parseInt(trailingEp[1], 10);

  return null;
}

function scoreToshoTorrent(item: ToshoFeedItem, episodeNum: number): number {
  const title = item.title || "";
  const titleLower = title.toLowerCase();
  const files = item.num_files ?? 0;

  let score = 0;
  if (item.status === "complete") score += 150;
  else if (item.status === "unknown") score -= 150;

  if (files >= 4) score += 100;
  else if (files >= 2) score += 50;

  const titleEp = extractEpisodeNumber(title);
  if (titleEp !== null) {
    score += titleEp === episodeNum ? 80 : -200;
  }

  if (/\b(?:promo|creditless|ncop|nced|pv|raw)\b/i.test(titleLower)) {
    score -= 120;
  }
  if (/\b(?:srt|ass|dual[\s-]?audio|eng)\b/i.test(titleLower)) {
    score += 20;
  }
  if (files > 200) score -= 40;
  return score;
}

async function fetchToshoTorrentFiles(
  torrentId: number,
  options: SubtitleResolverOptions
): Promise<ToshoFile[]> {
  const cached = torrentFilesCache.get(torrentId);
  if (cached) return cached;

  const detail = await fetchJsonWithFallback(
    `https://feed.animetosho.net/json?show=torrent&id=${torrentId}`,
    options,
    true
  );
  const files: ToshoFile[] = Array.isArray(detail?.files) ? detail.files : [];
  torrentFilesCache.set(torrentId, files);
  return files;
}

function getAttachmentFilename(att: ToshoAttachment): string {
  try {
    const parsed = new URL(att.url || "");
    return parsed.searchParams.get("filename") || parsed.pathname || "";
  } catch {
    return att.url || "";
  }
}

function isEnglishTextSubtitle(att: ToshoAttachment): boolean {
  if (att.type !== "subtitle" || !att.url) return false;

  const format = (att.info?.format || "").toUpperCase();
  const filename = getAttachmentFilename(att);
  if (format === "VOB" || format === "PGS" || format === "SUP") return false;
  if (format && !SUBTITLE_TEXT_FORMATS.has(format)) return false;
  if (!format && !/\.(?:srt|ass|ssa|vtt)(?:\.xz)?$/i.test(filename)) return false;

  const langCode = (att.info?.language_code || "").trim().toLowerCase();
  const langName = (att.info?.language || "").trim().toLowerCase();
  if (langCode) {
    return /^(?:en|eng|en-us|en-gb)$/.test(langCode);
  }
  if (langName) {
    return /\benglish\b/.test(langName);
  }
  return /[._-](?:en|eng)\.(?:srt|ass|ssa|vtt)(?:\.xz)?$/i.test(filename);
}

function rankSubtitleAttachment(att: ToshoAttachment): number {
  let score = 0;
  if (att.info?.forced) score -= 50;
  if (att.info?.default) score += 20;
  const name = (att.info?.name || "").toLowerCase();
  if (/\b(?:full|dialogue|english|subtitles)\b/.test(name)) score += 15;
  if (/\b(?:signs|songs|karaoke)\b/.test(name)) score -= 35;
  const format = (att.info?.format || "").toUpperCase();
  if (format === "SRT" || format === "VTT") score += 10;
  return score;
}

function parseClockSeconds(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length !== 3) return 0;
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const s = Number(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

function normalizeAssTimestamp(raw: string): { text: string; seconds: number } | null {
  const match = raw.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{1,3})$/);
  if (!match) return null;
  const hours = match[1].padStart(2, "0");
  const ms = match[4].padEnd(3, "0").slice(0, 3);
  const text = `${hours}:${match[2]}:${match[3]}.${ms}`;
  return { text, seconds: parseClockSeconds(text) };
}

function cleanAssDialogueText(rawText: string): string {
  // Drop ASS vector drawing sequences ({\p1}...{\p0} or unclosed {\p1}...)
  const withoutDrawings = rawText
    .replace(/\{[^}]*\\p[1-9]\d*(?:\b|[^}0-9])[^}]*\}[\s\S]*?(?=\{[^}]*\\p0[^}]*\}|$)/g, "")
    .replace(/\{[^}]*\}/g, "");

  return withoutDrawings
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\h/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Convert ASS/SSA subtitle scripts into standard WebVTT cues. */
function convertAssToWebVtt(raw: string): string {
  const lines = raw.split("\n");
  let inEvents = false;
  let columns = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"];

  const cues: Array<{ startSec: number; start: string; end: string; text: string }> = [];
  const seenCues = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      inEvents = /^\[Events\]$/i.test(line);
      continue;
    }
    if (!inEvents) continue;

    if (/^Format:/i.test(line)) {
      columns = line
        .slice(7)
        .split(",")
        .map((c) => c.trim());
      continue;
    }

    if (!/^Dialogue:/i.test(line)) continue;

    const payload = line.slice(9).trimStart();
    const parts: string[] = [];
    let cursor = 0;
    for (let i = 0; i < columns.length - 1; i++) {
      const commaIdx = payload.indexOf(",", cursor);
      if (commaIdx === -1) break;
      parts.push(payload.slice(cursor, commaIdx));
      cursor = commaIdx + 1;
    }
    parts.push(payload.slice(cursor));

    const startIdx = columns.findIndex((c) => c.toLowerCase() === "start");
    const endIdx = columns.findIndex((c) => c.toLowerCase() === "end");
    const textIdx = columns.findIndex((c) => c.toLowerCase() === "text");
    if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;

    const start = normalizeAssTimestamp(parts[startIdx] || "");
    const end = normalizeAssTimestamp(parts[endIdx] || "");
    if (!start || !end || end.seconds <= start.seconds) continue;

    const cleanText = cleanAssDialogueText(parts[textIdx] || "");
    if (!cleanText) continue;

    const dedupKey = `${start.text}|${end.text}|${cleanText}`;
    if (seenCues.has(dedupKey)) continue;
    seenCues.add(dedupKey);

    cues.push({ startSec: start.seconds, start: start.text, end: end.text, text: cleanText });
  }

  cues.sort((a, b) => a.startSec - b.startSec);
  const body = cues.map((c) => `${c.start} --> ${c.end}\n${c.text}`).join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

/** Convert SRT/ASS/SSA subtitle content into WebVTT text cleanly. */
export function convertSubtitleToWebVtt(rawContent: string): string {
  const normalized = rawContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  if (normalized.startsWith("WEBVTT")) {
    return `${normalized}\n`;
  }

  if (/(?:^|\n)\s*\[Events\]/i.test(normalized) && /(?:^|\n)\s*Dialogue:/i.test(normalized)) {
    return convertAssToWebVtt(normalized);
  }

  const vttBody = normalized
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/(\d{1,2}):(\d{2}):(\d{2}),(\d{3})/g, (_, h, m, s, ms) => `${h.padStart(2, "0")}:${m}:${s}.${ms}`)
    .replace(/(^|\s)(\d{2}):(\d{2}),(\d{3})/g, "$100:$2:$3.$4");

  return `WEBVTT\n\n${vttBody}\n`;
}

async function downloadAndConvertSubtitle(
  att: ToshoAttachment,
  options: SubtitleResolverOptions
): Promise<SubtitleTrack | null> {
  if (!att.url) return null;

  const filename = getAttachmentFilename(att);
  const isXz = /\.xz(?:[?#]|$)/i.test(att.url) || /\.xz$/i.test(filename);
  const proxyCandidates = options.buildProxyUrls(att.url, "https://animetosho.org/");

  for (const proxyUrl of proxyCandidates) {
    try {
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok || !res.body) continue;

      let rawText: string;
      if (isXz) {
        if (!XzStream) throw new Error("XzReadableStream unavailable");
        const decompressed = new XzStream(res.body);
        rawText = await new Response(decompressed).text();
      } else {
        rawText = await res.text();
      }

      const vttText = convertSubtitleToWebVtt(rawText);
      if (!vttText || !vttText.includes("-->")) continue;

      const blobUrl = URL.createObjectURL(new Blob([vttText], { type: "text/vtt" }));
      return {
        id: `animetosho-eng-${att.id ?? Date.now()}`,
        url: blobUrl,
        label: "English",
        lang: "en",
        type: "vtt",
      };
    } catch {
      // Try next proxy candidate
    }
  }

  return null;
}

function storeCachedSubtitles(cacheKey: string, tracks: SubtitleTrack[]): void {
  if (tracks.length === 0) return;

  if (subtitleBlobCache.size >= MAX_CACHED_BLOBS) {
    const oldestKey = subtitleBlobCache.keys().next().value;
    if (oldestKey) {
      const oldTracks = subtitleBlobCache.get(oldestKey) || [];
      for (const t of oldTracks) {
        if (t.url.startsWith("blob:")) {
          URL.revokeObjectURL(t.url);
        }
      }
      subtitleBlobCache.delete(oldestKey);
    }
  }

  subtitleBlobCache.set(cacheKey, tracks);
}

async function resolveInternal(
  animeId: number,
  episodeNum: number,
  options: SubtitleResolverOptions
): Promise<SubtitleTrack[]> {
  const aid = await resolveAniDbId(animeId, options);
  if (!aid) return [];

  let torrents = toshoFeedCache.get(aid);
  if (!torrents) {
    const feed = await fetchJsonWithFallback(
      `https://feed.animetosho.net/json?aid=${aid}`,
      options,
      true
    );
    torrents = Array.isArray(feed) ? feed : [];
    if (torrents.length > 0) {
      toshoFeedCache.set(aid, torrents);
    }
  }

  if (torrents.length === 0) return [];

  const selectTopTorrents = (items: ToshoFeedItem[]): ToshoFeedItem[] => {
    const byId = new Map<number, ToshoFeedItem>();
    for (const item of items) {
      if (item?.id && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    const unique = [...byId.values()];
    const complete = unique.filter((t) => t.status === "complete");
    const pool = complete.length > 0 ? complete : unique;
    return pool
      .sort((a, b) => scoreToshoTorrent(b, episodeNum) - scoreToshoTorrent(a, episodeNum))
      .slice(0, 6);
  };

  let ranked = selectTopTorrents(torrents);

  // If the primary feed contains only newer episodes (e.g., long seasonal run without a batch yet),
  // run one targeted episode-number search on AnimeTosho.
  const paddedEp = String(episodeNum).padStart(2, "0");
  const hasBatchOrEpMatch = ranked.some(
    (t) => (t.num_files ?? 0) >= episodeNum || extractEpisodeNumber(t.title || "") === episodeNum
  );
  if (!hasBatchOrEpMatch) {
    const epFeed = await fetchJsonWithFallback(
      `https://feed.animetosho.net/json?t=search&aid=${aid}&q=${encodeURIComponent(paddedEp)}`,
      options,
      true
    );
    if (Array.isArray(epFeed) && epFeed.length > 0) {
      ranked = selectTopTorrents([...epFeed, ...torrents]);
    }
  }

  // Inspect all top candidate torrents concurrently in a single round-trip.
  const filesPerTorrent = await Promise.all(
    ranked.map((t) => fetchToshoTorrentFiles(t.id, options).then((files) => ({ torrent: t, files })))
  );

  const candidateAttachments: ToshoAttachment[] = [];
  for (const { torrent, files } of filesPerTorrent) {
    if (files.length === 0) continue;

    const matchedFiles = files.filter((file) => {
      const ep = extractEpisodeNumber(file.filename || "");
      if (ep !== null) return ep === episodeNum;
      return files.length === 1 && episodeNum === 1 && (torrent.num_files ?? 1) <= 1;
    });

    for (const file of matchedFiles) {
      for (const att of file.attachments || []) {
        if (isEnglishTextSubtitle(att)) {
          candidateAttachments.push(att);
        }
      }
    }
  }

  if (candidateAttachments.length === 0) return [];

  candidateAttachments.sort((a, b) => rankSubtitleAttachment(b) - rankSubtitleAttachment(a));

  for (const att of candidateAttachments.slice(0, 3)) {
    const track = await downloadAndConvertSubtitle(att, options);
    if (track) {
      return [track];
    }
  }

  return [];
}

/**
 * Fallback resolver that fetches English text subtitles (.srt/.ass/.vtt) from AnimeTosho
 * when streaming servers do not provide any English subtitle tracks.
 */
export async function resolveExternalEnglishSubtitles(
  animeId: number,
  episodeNum: number,
  options: SubtitleResolverOptions
): Promise<SubtitleTrack[]> {
  if (!animeId || !episodeNum) return [];

  const cacheKey = `${animeId}:${episodeNum}`;
  const cached = subtitleBlobCache.get(cacheKey);
  if (cached) return cached;

  const existing = inFlightRequests.get(cacheKey);
  if (existing) return existing;

  const deadlinePromise = new Promise<SubtitleTrack[]>((resolve) => {
    setTimeout(() => resolve([]), RESOLVE_DEADLINE_MS);
  });

  const task = resolveInternal(animeId, episodeNum, options)
    .then((tracks) => {
      storeCachedSubtitles(cacheKey, tracks);
      return tracks;
    })
    .catch(() => [])
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, task);
  return Promise.race([task, deadlinePromise]);
}

