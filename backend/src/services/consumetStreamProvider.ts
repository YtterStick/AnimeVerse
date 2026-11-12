import { ANIME } from "@consumet/extensions";
import axios from "axios";
import NodeCache from "node-cache";
import {
  StreamProvider,
  StreamResult,
  StreamServer,
  MultiStreamResult,
  SubtitleTrack,
  SkipInterval,
} from "./streamProvider";
import { jikanService } from "./jikanService";
import { getKnownStreams } from "./knownStreamRegistry";

// Cache resolved slugs for 7 days (exact MAL mappings never change), 3 min for streams
const slugCache = new NodeCache({ stdTTL: 7 * 24 * 3600, checkperiod: 600 });
const streamCache = new NodeCache({ stdTTL: 180, checkperiod: 60 });

interface AnimeMetadata {
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  synonyms: string[];
  year: number | null;
  type: string;
  episodes: number | null;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const KAA_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  Referer: "https://kaa.lt/",
};

/**
 * Multi-provider English SUB + DUB stream aggregator.
 * Resolves accurate anime seasons/titles via MALSync + AniList/Jikan metadata
 * and extracts both SUB (Japanese Audio + English Subtitles) and DUB (English Audio)
 * streams from KickAssAnime (kaa.lt) and AnimeHeaven (animeheaven.me).
 */
export class ConsumetStreamProvider implements StreamProvider {
  private kaa: any;
  private animeUnity: any;
  private readonly providerTimeoutMs = 8500;

  constructor() {
    this.kaa = new ANIME.KickAssAnime();
    this.kaa.baseUrl = "https://kaa.lt";
    this.animeUnity = new ANIME.AnimeUnity();
    this.animeUnity.client.defaults.headers.common["User-Agent"] = USER_AGENT;
    this.animeUnity.client.defaults.headers.common["Accept"] =
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
    this.animeUnity.client.defaults.headers.common["Accept-Language"] = "en-US,en;q=0.9";
    this.animeUnity.client.defaults.headers.common["Referer"] = "https://www.animeunity.to/";
    this.animeUnity.client.defaults.timeout = 8000;
    console.log(
      `[StreamProvider] Initialized providers: KickAssAnime (SUB & DUB) + AnimeHeaven (Hard-Sub) + ZokoAnime (SUB & DUB) + AnimeUnity (SUB)`
    );
  }

  // ─── URL & Subtitle Helpers ───────────────────────────────

  private sanitizeUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith("//")) {
      return `https:${trimmed.replace(/^\/+/, "//")}`;
    }
    return trimmed
      .replace(/^https?:\/{3,}/i, "https://")
      .replace(/^https:https:\/\//i, "https://")
      .replace(/^http:\/\//i, "https://");
  }

  private proxyUrl(
    url: string,
    audioPref?: "jpn" | "eng",
    customReferer?: string,
    quality?: string
  ): string {
    const clean = this.sanitizeUrl(url);
    let proxied = `/api/stream/proxy?url=${encodeURIComponent(clean)}`;
    if (audioPref) {
      proxied += `&audio=${audioPref}`;
    }
    if (customReferer) {
      proxied += `&referer=${encodeURIComponent(customReferer)}`;
    }
    if (quality) {
      proxied += `&quality=${encodeURIComponent(quality)}`;
    }
    return proxied;
  }

  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&#x27;": "'",
      "&#x2F;": "/",
      "&#x60;": "`",
      "&#x3D;": "=",
    };
    return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
  }

  private normalizeSubtitles(
    subtitles: Array<{ url: string; lang: string; label?: string; id?: string }> | undefined
  ): SubtitleTrack[] {
    if (!subtitles?.length) return [];

    const seenUrls = new Set<string>();
    const rawItems: Array<SubtitleTrack & { isEnglish: boolean }> = [];

    for (const sub of subtitles) {
      if (!sub?.url) continue;
      const cleanUrl = this.sanitizeUrl(sub.url);
      if (seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      const rawLang = typeof sub.lang === "string" ? sub.lang.trim() : "und";
      const rawLabel = typeof sub.label === "string" ? sub.label.trim() : "";

      const match = rawLang.match(/^(.*)\s\(([^()]+)\)$/);
      const baseLabel = (rawLabel || match?.[1] || rawLang || "Subtitle").trim();
      const baseLang = (match?.[2] || rawLang || "en").trim();

      const combined = `${baseLabel} ${baseLang}`.toLowerCase();
      const isEnglish =
        /(^|[-_\s])(en|eng|english|en-us|en-gb)($|[-_\s])/i.test(combined) ||
        /_en\.(vtt|srt)/i.test(cleanUrl);

      rawItems.push({
        id: sub.id,
        url: this.proxyUrl(cleanUrl),
        label: isEnglish ? "English" : baseLabel,
        lang: isEnglish ? "en" : baseLang.toLowerCase().slice(0, 5),
        // Our proxy converts all SRT/VTT files into valid WEBVTT
        type: "vtt",
        isEnglish,
      });
    }

    // Sort English tracks first
    rawItems.sort((a, b) => Number(b.isEnglish) - Number(a.isEnglish));

    // Disambiguate duplicate labels so Vidstack shows each track clearly
    const labelCounts = new Map<string, number>();
    return rawItems.map((item, idx) => {
      const count = (labelCounts.get(item.label) || 0) + 1;
      labelCounts.set(item.label, count);
      const finalLabel = count > 1 ? `${item.label} (${count})` : item.label;
      return {
        id: item.id || `sub-${item.lang}-${idx}`,
        url: item.url,
        label: finalLabel,
        lang: item.lang,
        type: "vtt",
      };
    });
  }

  // ─── Metadata & Title Matching ────────────────────────────

  private async getAnimeMetadata(malId: number): Promise<AnimeMetadata | null> {
    try {
      const res = await jikanService.getAnimeDetails(malId);
      const data = res?.data;
      if (!data) return null;

      const year =
        data.year ||
        (data.aired?.from ? new Date(data.aired.from).getFullYear() : null) ||
        null;

      const synonyms: string[] = [];
      if (Array.isArray(data.title_synonyms)) {
        synonyms.push(...data.title_synonyms);
      }
      if (Array.isArray(data.titles)) {
        for (const t of data.titles) {
          if (t?.title) synonyms.push(t.title);
        }
      }

      return {
        malId,
        title: data.title,
        titleEnglish: data.title_english || null,
        titleJapanese: data.title_japanese || null,
        synonyms: [...new Set(synonyms.filter(Boolean))],
        year: year && !isNaN(year) ? year : null,
        type: (data.type || "TV").toUpperCase(),
        episodes: data.episodes || null,
      };
    } catch (err) {
      console.warn(`[StreamProvider] Metadata lookup failed for MAL ${malId}:`, (err as Error).message);
      return null;
    }
  }

  private normalizeTitleForMatch(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\u2018\u2019'`]/g, "")
      .replace(/\b2nd\s+season\b/g, "season 2")
      .replace(/\b3rd\s+season\b/g, "season 3")
      .replace(/\b4th\s+season\b/g, "season 4")
      .replace(/\b5th\s+season\b/g, "season 5")
      .replace(/\bseason\s+0*(\d+)\b/g, "season $1")
      .replace(/\bpart\s+0*(\d+)\b/g, "part $1")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractSeasonNumber(normTitle: string): number {
    const m =
      normTitle.match(/\bseason\s+(\d+)\b/) ||
      normTitle.match(/\bs(\d+)\b/) ||
      normTitle.match(/\b(\d+)\s+season\b/);
    if (m) return parseInt(m[1], 10);
    if (/\b(?:ii|2)\b$/.test(normTitle)) return 2;
    if (/\b(?:iii|3)\b$/.test(normTitle)) return 3;
    if (/\b(?:iv|4)\b$/.test(normTitle)) return 4;
    return 1;
  }

  private scoreCandidate(
    meta: AnimeMetadata,
    candidateTitles: (string | null | undefined)[],
    candidateYear?: number | string | null,
    candidateType?: string | null
  ): number {
    const targetTitles = [meta.title, meta.titleEnglish, ...meta.synonyms]
      .filter((t): t is string => Boolean(t))
      .map((t) => this.normalizeTitleForMatch(t));

    const candNorms = candidateTitles
      .filter((t): t is string => Boolean(t && t !== "undefined"))
      .map((t) => this.normalizeTitleForMatch(t));

    if (candNorms.length === 0 || targetTitles.length === 0) return -999;

    const targetSeason = Math.max(...targetTitles.map((t) => this.extractSeasonNumber(t)));
    const candSeason = Math.max(...candNorms.map((t) => this.extractSeasonNumber(t)));

    let bestTitleScore = 0;
    for (const tNorm of targetTitles) {
      for (const cNorm of candNorms) {
        if (tNorm === cNorm) {
          bestTitleScore = Math.max(bestTitleScore, 100);
        } else if (tNorm.includes(cNorm) || cNorm.includes(tNorm)) {
          const ratio = Math.min(tNorm.length, cNorm.length) / Math.max(tNorm.length, cNorm.length);
          bestTitleScore = Math.max(bestTitleScore, Math.round(75 * ratio));
        } else {
          const tWords = new Set(tNorm.split(" ").filter((w) => w.length > 1));
          const cWords = cNorm.split(" ").filter((w) => w.length > 1);
          const overlap = cWords.filter((w) => tWords.has(w)).length;
          if (overlap > 0) {
            const ratio = overlap / Math.max(tWords.size, cWords.length);
            bestTitleScore = Math.max(bestTitleScore, Math.round(60 * ratio));
          }
        }
      }
    }

    let score = bestTitleScore;

    // Season number alignment is critical so Season 1 doesn't match Season 2/3/4
    if (targetSeason === candSeason) {
      score += 25;
    } else {
      score -= 60;
    }

    // Penalize movies/recaps/specials/pvs when looking for a TV series
    const candJoined = candNorms.join(" ");
    const targetJoined = targetTitles.join(" ");
    if (/\b(pv|preview|cm|recap|mini anime)\b/.test(candJoined) && !/\b(pv|recap|mini)\b/.test(targetJoined)) {
      score -= 80;
    }
    if (meta.type === "TV" && /\b(movie|ova|special)\b/.test(candJoined) && !/\b(movie|ova|special)\b/.test(targetJoined)) {
      score -= 50;
    }

    if (candidateType && meta.type) {
      if (candidateType.toUpperCase() === meta.type.toUpperCase()) {
        score += 15;
      } else if (meta.type === "TV" && candidateType.toUpperCase() === "MOVIE") {
        score -= 40;
      }
    }

    // Year check
    const cYear = candidateYear ? parseInt(String(candidateYear), 10) : null;
    if (meta.year && cYear && !isNaN(cYear)) {
      if (meta.year === cYear) {
        score += 35;
      } else if (Math.abs(meta.year - cYear) === 1) {
        score += 10;
      } else {
        score -= Math.min(50, Math.abs(meta.year - cYear) * 15);
      }
    }

    return score;
  }

  private getCandidateTitles(meta: AnimeMetadata): string[] {
    const list: string[] = [
      meta.title,
      meta.titleEnglish || "",
      ...meta.synonyms,
    ];

    const cleaned: string[] = [];
    for (const t of list) {
      if (!t) continue;
      cleaned.push(t);
      // Strip leading abbreviations, prefixes and colons (e.g. "S.A: Special A" -> "Special A")
      const afterColon = t.replace(/^[^:]+:\s*/, "").trim();
      if (afterColon && afterColon !== t) cleaned.push(afterColon);
      const beforeColon = t.split(":")[0]?.trim();
      if (beforeColon && beforeColon !== t && beforeColon.length > 2) cleaned.push(beforeColon);
      // Strip punctuation (e.g. "S.A." -> "SA", "Re:Zero" -> "Re Zero")
      const strippedPunct = t.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
      if (strippedPunct && strippedPunct !== t) cleaned.push(strippedPunct);
      // Strip parenthetical text (e.g. "(TV)", "(2008)")
      const noParen = t.replace(/\s*\([^)]*\)/g, "").trim();
      if (noParen && noParen !== t) cleaned.push(noParen);
    }

    return [...new Set(cleaned.filter((t): t is string => Boolean(t && t.length >= 2)))];
  }

  // ─── KickAssAnime (kaa.lt) SUB + DUB Resolver ─────────────

  private async resolveKAASlug(meta: AnimeMetadata): Promise<string | null> {
    const cacheKey = `kaa-slug:${meta.malId}`;
    const cached = slugCache.get<string>(cacheKey);
    if (cached) return cached;

    // 1. Try MALSync first (exact MAL ID mapping)
    try {
      const res = await axios.get(`https://api.malsync.moe/mal/anime/${meta.malId}`, {
        timeout: 7000,
      });
      const entries = Object.values(res.data?.Sites?.KickAssAnime || {}) as any[];
      if (entries.length > 0 && entries[0].identifier) {
        const slug = String(entries[0].identifier);
        slugCache.set(cacheKey, slug, 7 * 24 * 3600);
        return slug;
      }
    } catch {
      // Fall through to KAA fsearch
    }

    // 2. Search KAA /api/fsearch with candidate titles and score results
    const queries = this.getCandidateTitles(meta);

    const candidates = new Map<string, any>();

    for (const q of queries.slice(0, 3)) {
      try {
        const res = await axios.post(
          "https://kaa.lt/api/fsearch",
          { query: q, page: 1 },
          {
            headers: {
              "User-Agent": USER_AGENT,
              "Content-Type": "application/json",
              Accept: "application/json",
              Referer: "https://kaa.lt/anime",
            },
            timeout: 5000,
          }
        );

        for (const item of res.data?.result || []) {
          if (item?.slug && Array.isArray(item.locales) && item.locales.length > 0) {
            candidates.set(item.slug, item);
          }
        }

        if (candidates.size > 0) {
          // Check if we already have a near-perfect match
          const topNow = [...candidates.values()]
            .map((c) => ({
              slug: c.slug,
              score: this.scoreCandidate(meta, [c.title, c.title_en, c.title_original], c.year, c.type),
            }))
            .sort((a, b) => b.score - a.score)[0];
          if (topNow && topNow.score >= 135) {
            slugCache.set(cacheKey, topNow.slug);
            return topNow.slug;
          }
        }
      } catch {
        // Continue to next query
      }
    }

    if (candidates.size === 0) return null;

    const scored = [...candidates.values()]
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        score: this.scoreCandidate(meta, [c.title, c.title_en, c.title_original], c.year, c.type),
      }))
      .sort((a, b) => b.score - a.score);

    console.log(
      `[KAA] Top search match for "${meta.title}" (${meta.year}): ${scored[0].slug} (score=${scored[0].score})`
    );

    if (scored[0].score < 40) return null;

    slugCache.set(cacheKey, scored[0].slug);
    return scored[0].slug;
  }

  /**
   * Extract manifest and subtitles from a KAA cat-player URL.
   */
  private async extractKAACatPlayer(
    serverUrl: string,
    serverName: string
  ): Promise<{
    manifestUrl: string | null;
    subtitles: Array<{ url: string; lang: string; label: string }>;
    thumbnails: string | null;
  }> {
    const cleanServerUrl = this.sanitizeUrl(serverUrl);

    if (cleanServerUrl.includes("/cat-player/")) {
      const response = await axios.get(cleanServerUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://kaa.lt/",
        },
        timeout: 8000,
      });

      const html = String(response.data || "");
      const propsMatch = html.match(/props="([^"]+)"/);
      if (!propsMatch) {
        throw new Error("Could not find props in cat-player HTML");
      }

      const jsonData = JSON.parse(this.decodeHtmlEntities(propsMatch[1]));
      const rawManifest = jsonData?.manifest?.[1] ? String(jsonData.manifest[1]) : null;
      const manifestUrl = rawManifest ? this.sanitizeUrl(rawManifest) : null;

      // Ignore DASH (.mpd) manifests since we want HLS (.m3u8) or MP4
      if (manifestUrl && /\.mpd(?:[?#]|$)/i.test(manifestUrl)) {
        return { manifestUrl: null, subtitles: [], thumbnails: null };
      }

      const subtitles: Array<{ url: string; lang: string; label: string }> = [];
      const subtitleArray = jsonData?.subtitles?.[1];
      if (Array.isArray(subtitleArray)) {
        for (const entry of subtitleArray) {
          const sub = entry?.[1];
          const src = sub?.src?.[1];
          const name = sub?.name?.[1] || "Subtitle";
          const lang = sub?.language?.[1] || name;
          if (src) {
            subtitles.push({
              url: this.sanitizeUrl(String(src)),
              lang: String(lang),
              label: String(name),
            });
          }
        }
      }

      const rawThumbnails = jsonData?.thumbnails?.[1] ? String(jsonData.thumbnails[1]) : null;
      const thumbnails = rawThumbnails ? this.sanitizeUrl(rawThumbnails) : null;

      return { manifestUrl, subtitles, thumbnails };
    }

    // Fallback for non-cat-player servers
    return { manifestUrl: cleanServerUrl, subtitles: [], thumbnails: null };
  }

  /**
   * Inspect a master.m3u8 playlist to see if it has embedded Japanese/English audio tracks
   * and what quality levels it provides.
   */
  private async inspectMasterM3U8(masterUrl: string): Promise<{
    hasEnglishAudio: boolean;
    hasJapaneseAudio: boolean;
    hasAudioGroups: boolean;
    qualities: Array<{ quality: string; url: string }>;
  }> {
    try {
      const res = await axios.get(masterUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: "https://krussdomi.com/",
          Origin: "https://krussdomi.com",
        },
        responseType: "text",
        timeout: 6000,
      });

      const text = String(res.data || "");
      const lines = text.replace(/\r\n/g, "\n").split("\n");
      const parentBase = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);

      const audioLines = lines.filter((l) => l.trim().startsWith("#EXT-X-MEDIA:TYPE=AUDIO"));
      const hasAudioGroups = audioLines.length > 0;
      const hasEnglishAudio = audioLines.some((l) =>
        /LANGUAGE="(?:en|eng|en-US|en-GB)"|NAME="[^"]*(?:English|Eng)[^"]*"/i.test(l)
      );
      const hasJapaneseAudio = audioLines.some((l) =>
        /LANGUAGE="(?:ja|jpn|ja-JP)"|NAME="[^"]*(?:Japanese|Jpn|Original)[^"]*"/i.test(l)
      );

      const qualities: Array<{ quality: string; url: string }> = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-STREAM-INF:")) {
          const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
          const height = resMatch ? `${resMatch[1]}p` : "Auto";
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && !nextLine.startsWith("#")) {
            const fullUrl = nextLine.startsWith("http")
              ? this.sanitizeUrl(nextLine)
              : new URL(nextLine, parentBase).toString();
            qualities.push({ quality: height, url: fullUrl });
          }
        }
      }

      // Sort qualities highest to lowest (1080p -> 720p -> 480p -> 360p)
      qualities.sort((a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10));

      return { hasEnglishAudio, hasJapaneseAudio, hasAudioGroups, qualities };
    } catch {
      return {
        hasEnglishAudio: false,
        hasJapaneseAudio: false,
        hasAudioGroups: false,
        qualities: [],
      };
    }
  }

  /**
   * Transforms raw provider names (VidStreaming, BirdStream, DuckStream) into clean, premium anime streaming server names.
   */
  private formatServerName(rawName: string, index = 0): string {
    const lower = (rawName || "").toLowerCase();
    if (lower.includes("vidstreaming")) return "Nova HD";
    if (lower.includes("birdstream")) return "Zenith HD";
    if (lower.includes("duckstream")) return "Eclipse HD";
    if (lower.includes("animeheaven")) return "Aether HD";
    if (lower.includes("gogoanime")) return "Orion HD";
    if (lower.includes("streamsb")) return "Vortex HD";
    if (lower.includes("streamtape")) return "Mirage HD";
    const defaults = ["Nova HD", "Zenith HD", "Eclipse HD", "Aether HD", "Orion HD"];
    return defaults[index % defaults.length] || `Server ${index + 1} (HD)`;
  }

  /**
   * Fetch both SUB (ja-JP) and DUB (en-US) servers from KickAssAnime.
   */
  private async fetchKAAServers(meta: AnimeMetadata, episode: number): Promise<StreamServer[]> {
    const servers: StreamServer[] = [];

    try {
      const kaaSlug = await this.resolveKAASlug(meta);
      if (!kaaSlug) return servers;

      const showHeaders = KAA_HEADERS;

      const showRes = await axios.get(`https://kaa.lt/api/show/${kaaSlug}`, {
        headers: showHeaders,
        timeout: 6000,
      });

      const locales: string[] = Array.isArray(showRes.data?.locales)
        ? showRes.data.locales
        : ["ja-JP", "en-US"];

      const targetLocales: Array<{ locale: string; category: "SUB" | "DUB" }> = [];
      if (locales.includes("ja-JP") || locales.length === 0) {
        targetLocales.push({ locale: "ja-JP", category: "SUB" });
      }
      if (locales.includes("en-US")) {
        targetLocales.push({ locale: "en-US", category: "DUB" });
      }

      let foundDubServer = false;
      let sharedEnglishAudioMaster: {
        url: string;
        serverName: string;
        subtitles: SubtitleTrack[];
        quality?: string;
        thumbnails?: string;
      } | null = null;

      await Promise.all(
        targetLocales.map(async ({ locale, category }) => {
          try {
            const epsRes = await axios.get(
              `https://kaa.lt/api/show/${kaaSlug}/episodes?ep=${episode}&lang=${locale}`,
              { headers: showHeaders, timeout: 6000 }
            );

            const epList: any[] = epsRes.data?.result || [];
            const targetEp = epList.find(
              (ep) =>
                Math.floor(Number(ep.episode_number)) === episode ||
                String(ep.episode_string) === String(episode)
            );
            if (!targetEp?.slug) return;

            const epNumStr = targetEp.episode_string || String(Math.floor(Number(targetEp.episode_number)));
            const epDetailRes = await axios.get(
              `https://kaa.lt/api/show/${kaaSlug}/episode/ep-${epNumStr}-${targetEp.slug}`,
              { headers: showHeaders, timeout: 6000 }
            );

            const epServers: Array<{ name: string; src: string }> = epDetailRes.data?.servers || [];
            if (epServers.length === 0) return;

            // Extract all servers for this locale in parallel
            const extractedList = await Promise.all(
              epServers.map(async (srv) => {
                try {
                  return {
                    srv,
                    extracted: await this.extractKAACatPlayer(srv.src, srv.name),
                  };
                } catch {
                  return null;
                }
              })
            );

            // Collect all subtitles and thumbnails across servers for this episode (so all servers share storyboards and subs!)
            const combinedRawSubs: Array<{ url: string; lang: string; label: string }> = [];
            let episodeThumbnails: string | null = null;
            for (const item of extractedList) {
              if (item?.extracted?.subtitles?.length) {
                combinedRawSubs.push(...item.extracted.subtitles);
              }
              if (!episodeThumbnails && item?.extracted?.thumbnails) {
                episodeThumbnails = item.extracted.thumbnails;
              }
            }
            const normalizedSubs = this.normalizeSubtitles(combinedRawSubs);

            for (let i = 0; i < extractedList.length; i++) {
              const item = extractedList[i];
              if (!item?.extracted?.manifestUrl) continue;

              const { srv, extracted } = item;
              const manifestUrl = extracted.manifestUrl!;
              const isHls = manifestUrl.includes(".m3u8");
              const serverSubs =
                extracted.subtitles.length > 0
                  ? this.normalizeSubtitles([...extracted.subtitles, ...combinedRawSubs])
                  : normalizedSubs;

              const rawThumb = extracted.thumbnails || episodeThumbnails;
              const serverThumbnails = rawThumb ? this.proxyUrl(rawThumb) : undefined;

              const m3u8Info = isHls
                ? await this.inspectMasterM3U8(manifestUrl)
                : { hasEnglishAudio: false, hasJapaneseAudio: false, hasAudioGroups: false, qualities: [] };

              const has2160 = m3u8Info.qualities.some((q) => parseInt(q.quality, 10) >= 2160);
              const has1440 = m3u8Info.qualities.some((q) => parseInt(q.quality, 10) >= 1440);
              const detectedQuality = has2160
                ? "2160p (4K)"
                : has1440
                ? "1440p (2K)"
                : m3u8Info.qualities[0]?.quality || "1080p";

              const serverDisplayName = this.formatServerName(srv.name, i);

              if (category === "SUB") {
                servers.push({
                  id: `kaa-sub-${srv.name.toLowerCase().replace(/\s+/g, "-")}-${i}`,
                  name: serverDisplayName,
                  category: "SUB",
                  url: isHls ? this.proxyUrl(manifestUrl, "jpn") : manifestUrl,
                  type: isHls ? "hls" : "mp4",
                  quality: detectedQuality,
                  subtitles: serverSubs,
                  thumbnails: serverThumbnails,
                });

                // Remember if the SUB master playlist also embeds an English Dub audio track
                if (m3u8Info.hasEnglishAudio && !sharedEnglishAudioMaster) {
                  sharedEnglishAudioMaster = {
                    url: manifestUrl,
                    serverName: srv.name,
                    subtitles: serverSubs,
                    quality: detectedQuality,
                    thumbnails: serverThumbnails,
                  };
                }
              } else {
                // DUB category
                foundDubServer = true;
                servers.push({
                  id: `kaa-dub-${srv.name.toLowerCase().replace(/\s+/g, "-")}-${i}`,
                  name: serverDisplayName,
                  category: "DUB",
                  url: isHls ? this.proxyUrl(manifestUrl, "eng") : manifestUrl,
                  type: isHls ? "hls" : "mp4",
                  quality: detectedQuality,
                  subtitles: serverSubs,
                  thumbnails: serverThumbnails,
                });
              }
            }
          } catch (err) {
            console.warn(`[KAA] Locale ${locale} failed:`, (err as Error).message);
          }
        })
      );

      // If no dedicated en-US episode server was found, but the master.m3u8 contains an English audio track, add it as DUB!
      if (!foundDubServer && sharedEnglishAudioMaster) {
        const master = sharedEnglishAudioMaster as {
          url: string;
          serverName: string;
          subtitles: SubtitleTrack[];
          quality?: string;
          thumbnails?: string;
        };
        servers.push({
          id: `kaa-dub-multiaudio-0`,
          name: this.formatServerName(master.serverName, 0),
          category: "DUB",
          url: this.proxyUrl(master.url, "eng"),
          type: "hls",
          quality: master.quality || "1080p",
          subtitles: master.subtitles,
          thumbnails: master.thumbnails,
        });
      }
    } catch (err) {
      console.warn(`[KAA] Failed:`, (err as Error).message);
    }

    return servers;
  }

  // ─── AnimeUnity (animeunity.to) SUB Resolver ─────────────────

  private async fetchAnimeUnityServers(meta: AnimeMetadata, episode: number): Promise<StreamServer[]> {
    const servers: StreamServer[] = [];

    try {
      // Search AnimeUnity using normalized candidate title queries
      const queries = this.getCandidateTitles(meta);

      let bestResult: any = null;
      let bestScore = -Infinity;

      for (const q of queries.slice(0, 4)) {
        try {
          const results = await this.animeUnity.search(q);
          for (const r of results?.results || []) {
            // Skip ITA (Italian dub) entries — we want Japanese audio
            if (/\(ITA\)/i.test(r.title || "")) continue;

            const score = this.scoreCandidate(
              meta,
              [r.title, r.id?.replace(/^\d+-/, "").replace(/-/g, " ")],
              null,
              null
            );
            if (score > bestScore) {
              bestScore = score;
              bestResult = r;
            }
          }
          if (bestScore >= 120) break; // High-confidence match, stop searching
        } catch {
          continue;
        }
      }

      if (!bestResult || bestScore < 40) return servers;

      console.log(
        `[AnimeUnity] Matched "${meta.title}" → "${bestResult.title}" (id=${bestResult.id}, score=${bestScore})`
      );

      // Fetch anime info to get episode list
      const info = await this.animeUnity.fetchAnimeInfo(bestResult.id);
      const episodes = info?.episodes || [];

      // Find the target episode by number
      const targetEp = episodes.find((ep: any) => ep.number === episode);
      if (!targetEp?.id) return servers;

      // Extract streaming sources
      const sources = await this.animeUnity.fetchEpisodeSources(targetEp.id);
      const validSources = (sources?.sources || []).filter(
        (s: any) => s?.url && s.isM3U8 !== false
      );

      if (validSources.length === 0) return servers;

      // Pick the best quality source (prefer 1080p, then default/highest)
      const sorted = [...validSources].sort((a: any, b: any) => {
        const aq = parseInt(a.quality, 10) || 0;
        const bq = parseInt(b.quality, 10) || 0;
        return bq - aq;
      });

      // Vixcloud has open CORS (Access-Control-Allow-Origin: *), so browsers can play directly
      // without proxy latency or datacenter IP blocks!
      const best = sorted[0];
      const isHls = best.url?.includes(".m3u8") || best.isM3U8;
      const detectedQuality = best.quality && best.quality !== "default"
        ? best.quality
        : "1080p";

      servers.push({
        id: `animeunity-sub-0`,
        name: "Stellar HD",
        category: "SUB",
        url: best.url,
        type: isHls ? "hls" : "mp4",
        quality: detectedQuality,
        subtitles: [],
      });

      // Also add proxied version as a backup server
      servers.push({
        id: `animeunity-sub-proxied`,
        name: "Stellar HD (Proxy)",
        category: "SUB",
        url: isHls
          ? this.proxyUrl(best.url, undefined, "https://www.animeunity.to/")
          : best.url,
        type: isHls ? "hls" : "mp4",
        quality: detectedQuality,
        subtitles: [],
      });

      // If there are multiple different quality sources, add a backup
      if (sorted.length > 1 && sorted[1].url !== sorted[0].url) {
        const backup = sorted[1];
        const backupIsHls = backup.url?.includes(".m3u8") || backup.isM3U8;
        servers.push({
          id: `animeunity-sub-backup`,
          name: "Stellar HD (Backup)",
          category: "SUB",
          url: backup.url,
          type: backupIsHls ? "hls" : "mp4",
          quality: backup.quality && backup.quality !== "default"
            ? backup.quality
            : "720p",
          subtitles: [],
        });
      }
    } catch (err) {
      console.warn(`[AnimeUnity] Failed:`, (err as Error).message);
    }

    return servers;
  }

  // ─── ZokoAnime (zokoanime.video) Clean English SUB & DUB Resolver ─

  private decodeZokoPayload(b64: string): any | null {
    try {
      const key = "otaku-embed-v1";
      const bytes = Buffer.from(b64.trim(), "base64");
      const out = Buffer.alloc(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        out[i] = bytes[i] ^ key.charCodeAt(i % key.length);
      }
      return JSON.parse(out.toString("utf8"));
    } catch {
      return null;
    }
  }

  private async fetchZokoServers(animeId: number, episode: number): Promise<StreamServer[]> {
    const categories: Array<"SUB" | "DUB"> = ["SUB", "DUB"];
    const resolved = await Promise.all(
      categories.map(async (category): Promise<StreamServer | null> => {
        const mode = category === "DUB" ? "dub" : "sub";
        try {
          const res = await axios.get(
            `https://zokoanime.video/stream/mal/${animeId}/${episode}/${mode}`,
            {
              headers: {
                "User-Agent": USER_AGENT,
                Referer: "https://hianime.at/",
              },
              timeout: 7000,
            }
          );
          const html = String(res.data || "");
          const blob = html.match(/window\.__P\s*=\s*"([^"]+)"/)?.[1];
          if (!blob) return null;

          const payload = this.decodeZokoPayload(blob);
          const streamUrl = typeof payload?.src === "string" ? this.sanitizeUrl(payload.src) : "";
          if (!streamUrl || !streamUrl.startsWith("http")) return null;

          const subtitles = this.normalizeZokoSubtitles(payload?.subtitles);
          const skips = this.normalizeZokoSkips(payload?.skip);

          return {
            id: `zoko-${mode}-0`,
            name: "Mirage HD",
            category,
            url: this.proxyUrl(streamUrl, undefined, "https://zokoanime.video/"),
            type: "hls",
            quality: "Auto",
            subtitles,
            ...(skips.length > 0 ? { skips } : {}),
          };
        } catch {
          return null;
        }
      })
    );

    return resolved.filter((s): s is StreamServer => Boolean(s));
  }

  private normalizeZokoSkips(rawSkip: any): SkipInterval[] {
    if (!rawSkip || typeof rawSkip !== "object") return [];
    const pairs: Array<["intro" | "outro", "op" | "ed"]> = [
      ["intro", "op"],
      ["outro", "ed"],
    ];
    const skips: SkipInterval[] = [];
    for (const [key, type] of pairs) {
      const seg = rawSkip[key];
      const start = Number(seg?.start);
      const end = Number(seg?.end);
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start + 15) {
        skips.push({ type, start, end, episodeLength: 0 });
      }
    }
    return skips;
  }

  private normalizeZokoSubtitles(rawSubs: any): SubtitleTrack[] {
    if (!Array.isArray(rawSubs)) return [];

    const scored: Array<{ track: SubtitleTrack; priority: number }> = [];
    for (let i = 0; i < rawSubs.length; i++) {
      const sub = rawSubs[i];
      const subUrl = this.sanitizeUrl(sub?.src || sub?.url || "");
      if (!subUrl || !subUrl.startsWith("http")) continue;

      const lang = String(sub.lang || "en").trim().toLowerCase();
      const rawLabel = String(sub.label || "").trim();
      const isEnglish = lang.startsWith("en") || /\benglish\b/i.test(rawLabel);
      const isSigns = /signs\s*&?\s*songs/i.test(rawLabel);

      const label = isEnglish
        ? isSigns
          ? "English (Signs & Songs)"
          : "English"
        : rawLabel.replace(/\s*\((?:SRT|ASS|VTT)\)\s*/gi, "").trim() || lang.toUpperCase();

      let priority = 0;
      if (isEnglish && !isSigns) priority += 100;
      else if (isEnglish) priority += 40;
      if (sub.default && !isSigns) priority += 20;

      scored.push({
        priority,
        track: {
          id: `zoko-sub-track-${i}`,
          url: this.proxyUrl(subUrl, undefined, "https://zokoanime.video/"),
          label,
          lang: isEnglish ? "en" : lang || "en",
          type: "vtt",
        },
      });
    }

    scored.sort((a, b) => b.priority - a.priority);
    return scored.map((item) => item.track);
  }

  // ─── AnimeHeaven (animeheaven.me) English Hard-Sub Resolver ─

  private async fetchAnimeHeavenServers(meta: AnimeMetadata, episode: number): Promise<StreamServer[]> {
    const servers: StreamServer[] = [];

    try {
      const queries = this.getCandidateTitles(meta).slice(0, 3);

      const candidateHrefs = new Set<string>();

      for (const q of queries) {
        try {
          const searchRes = await axios.get(
            `https://animeheaven.me/search.php?s=${encodeURIComponent(q)}`,
            {
              headers: { "User-Agent": USER_AGENT, Referer: "https://animeheaven.me/" },
              timeout: 3500,
            }
          );
          const html = String(searchRes.data || "");
          const matches = [...html.matchAll(/href=['"](anime\.php\?[a-z0-9]+)['"]/gi)];
          for (const m of matches.slice(0, 6)) {
            candidateHrefs.add(m[1]);
          }
          if (candidateHrefs.size > 0) break;
        } catch {
          // Try next query
        }
      }

      if (candidateHrefs.size === 0) return servers;

      // Fetch candidate pages in parallel and score them accurately
      const pages = await Promise.all(
        [...candidateHrefs].slice(0, 5).map(async (href) => {
          try {
            const pageRes = await axios.get(`https://animeheaven.me/${href}`, {
              headers: { "User-Agent": USER_AGENT, Referer: "https://animeheaven.me/" },
              timeout: 5000,
            });
            const pageHtml = String(pageRes.data || "");
            const enTitle = pageHtml.match(/<div class=['"]infotitle c['"]>([^<]+)<\/div>/i)?.[1]?.trim();
            const jpTitleRaw = pageHtml.match(/<div class=['"]infotitlejp c['"]>([^<]+)<\/div>/i)?.[1]?.trim();
            const jpTitles = jpTitleRaw ? jpTitleRaw.split(",").map((s) => s.trim()) : [];
            const yearMatch = pageHtml.match(/Year:\s*<div class=['"]inline c2['"]>(\d{4})<\/div>/i)?.[1];

            const score = this.scoreCandidate(
              meta,
              [enTitle, ...jpTitles],
              yearMatch ? parseInt(yearMatch, 10) : null,
              "TV"
            );

            return { href, pageHtml, enTitle, score };
          } catch {
            return null;
          }
        })
      );

      const bestPage = pages
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .sort((a, b) => b.score - a.score)[0];

      if (!bestPage || bestPage.score < 50) return servers;

      // Find the episode hash for the target episode number
      const epRegex = /<a[^>]+id\s*=\s*['"]([a-f0-9]+)['"][^>]*>[\s\S]*?<div\s+class=\s*['"]\s*watch2\s+bc\s*['"]\s*>(\d+)<\/div>/gi;
      let epHash: string | null = null;
      for (const match of bestPage.pageHtml.matchAll(epRegex)) {
        const epNum = parseInt(match[2], 10);
        if (epNum === episode) {
          epHash = match[1];
          break;
        }
      }

      if (!epHash) return servers;

      const gateRes = await axios.get("https://animeheaven.me/gate.php", {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: `https://animeheaven.me/${bestPage.href}`,
          Cookie: `key=${epHash}`,
        },
        timeout: 6000,
      });

      const gateHtml = String(gateRes.data || "");
      const rawSources = [...gateHtml.matchAll(/<source[^>]+src=['"]([^'"]+)['"]/gi)]
        .map((m) => m[1])
        .filter((u) => u && !u.includes("&error"));

      const uniqueSources = [...new Set(rawSources)];

      // AnimeHeaven sometimes serves a tiny ~3s "Watch on AnimeHeaven.Me" placeholder clip
      // instead of the real episode. Only drop sources that are CONFIRMED to be small placeholders (< 5MB).
      // If a probe times out (size === null), DO NOT discard the source!
      const probed = await Promise.all(
        uniqueSources.slice(0, 4).map(async (src) => ({ src, size: await this.probeVideoSize(src, epHash) }))
      );

      // Prioritize confirmed real sources (>= 5MB) over unprobed/unknown sources
      const realSources = probed.filter((p) => p.size !== null && p.size >= this.minRealEpisodeBytes).map((p) => p.src);
      const unknownSources = probed.filter((p) => p.size === null).map((p) => p.src);
      const candidateList = [...realSources, ...unknownSources];
      const sourcesToUse = candidateList.length > 0 ? candidateList : uniqueSources;

      if (sourcesToUse.length > 0) {
        // AnimeHeaven actively blocks cross-site browser requests (via Sec-Fetch-Site: cross-site)
        // with HTTP 400 Bad Request, so both primary and backup must be proxied through backend.
        servers.push({
          id: "animeheaven-sub-0",
          name: "Aether HD",
          category: "SUB",
          url: this.proxyUrl(sourcesToUse[0], undefined, "https://animeheaven.me/"),
          type: "mp4",
          quality: "1080p",
          subtitles: [],
        });

        // Backup proxied stream
        const backupSource = sourcesToUse[1] || sourcesToUse[0];
        servers.push({
          id: "animeheaven-sub-backup",
          name: "Orion HD",
          category: "SUB",
          url: this.proxyUrl(backupSource, undefined, "https://animeheaven.me/"),
          type: "mp4",
          quality: "1080p",
          subtitles: [],
        });
      }
    } catch (err) {
      console.warn(`[AnimeHeaven] Failed:`, (err as Error).message);
    }

    return servers;
  }

  /** Real episodes are tens/hundreds of MB; placeholder clips are ~100 KB. */
  private readonly minRealEpisodeBytes = 5 * 1024 * 1024;

  /**
   * Returns the total byte size of a remote MP4 using a 2-byte Range request,
   * or null if the source probe timed out / failed.
   */
  private async probeVideoSize(url: string, epHash?: string | null): Promise<number | null> {
    try {
      const headers: Record<string, string> = {
        "User-Agent": USER_AGENT,
        Referer: "https://animeheaven.me/",
        Range: "bytes=0-1",
      };
      if (epHash) {
        headers["Cookie"] = `key=${epHash}`;
      }
      const res = await axios.get(this.sanitizeUrl(url), {
        headers,
        responseType: "arraybuffer",
        timeout: 4000,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      const range = String(res.headers["content-range"] || "");
      const total = range.match(/\/(\d+)\s*$/)?.[1];
      if (total) return parseInt(total, 10);
      const len = res.headers["content-length"];
      return len ? parseInt(String(len), 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Step-by-step diagnostics for KickAssAnime resolution (used by /api/stream/debug).
   * Reports HTTP status + a short body preview for each upstream call so we can see
   * whether a host is blocking the server's IP.
   */
  async diagnoseKAA(animeId: number, episode: number): Promise<any[]> {
    const steps: any[] = [];
    const record = async (name: string, fn: () => Promise<any>) => {
      const started = Date.now();
      try {
        const res = await fn();
        const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        steps.push({ name, ok: true, status: res.status, ms: Date.now() - started, preview: String(body).slice(0, 200) });
        return res;
      } catch (err: any) {
        const body = err?.response?.data;
        steps.push({
          name,
          ok: false,
          status: err?.response?.status ?? null,
          ms: Date.now() - started,
          error: err?.message,
          server: err?.response?.headers?.server,
          preview: body ? String(typeof body === "string" ? body : JSON.stringify(body)).slice(0, 200) : undefined,
        });
        return null;
      }
    };
    const headers = { "User-Agent": USER_AGENT, Accept: "application/json", Referer: "https://kaa.lt/" };

    const ms = await record("malsync", () => axios.get(`https://api.malsync.moe/mal/anime/${animeId}`, { timeout: 5000 }));
    let slug = (Object.values(ms?.data?.Sites?.KickAssAnime || {}) as any[])[0]?.identifier;
    if (!slug) {
      const meta = await this.getAnimeMetadata(animeId);
      const search = await record("kaa-fsearch", () =>
        axios.post(
          "https://kaa.lt/api/fsearch",
          { query: meta?.title || "", page: 1 },
          { headers: { ...headers, "Content-Type": "application/json", Referer: "https://kaa.lt/anime" }, timeout: 6000 }
        )
      );
      slug = search?.data?.result?.[0]?.slug;
    }
    steps.push({ name: "slug", value: slug ?? null });
    if (!slug) return steps;

    await record("kaa-show", () => axios.get(`https://kaa.lt/api/show/${slug}`, { headers, timeout: 6000 }));
    const eps = await record("kaa-episodes", () =>
      axios.get(`https://kaa.lt/api/show/${slug}/episodes?ep=${episode}&lang=ja-JP`, { headers, timeout: 6000 })
    );
    const target = (eps?.data?.result || []).find((e: any) => Math.floor(Number(e.episode_number)) === episode);
    if (!target) return steps;

    const detail = await record("kaa-episode-detail", () =>
      axios.get(`https://kaa.lt/api/show/${slug}/episode/ep-${target.episode_string || episode}-${target.slug}`, {
        headers,
        timeout: 6000,
      })
    );
    const src = detail?.data?.servers?.[0]?.src;
    if (src) {
      await record("krussdomi-player", () =>
        axios.get(this.sanitizeUrl(src), { headers: { "User-Agent": USER_AGENT, Referer: "https://kaa.lt/" }, timeout: 8000 })
      );
    }
    return steps;
  }

  async diagnoseAU(query: string): Promise<any> {
    const started = Date.now();
    try {
      const results = await this.animeUnity.search(query);
      return {
        ok: true,
        ms: Date.now() - started,
        count: results?.results?.length || 0,
        results: (results?.results || []).slice(0, 5),
      };
    } catch (err: any) {
      return {
        ok: false,
        ms: Date.now() - started,
        error: err.message,
        status: err.response?.status,
        data: String(err.response?.data || "").slice(0, 300),
      };
    }
  }

  // ─── Timeout & Ordering Helpers ───────────────────────────

  private async withProviderTimeout<T>(label: string, promise: Promise<T>): Promise<T | null> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[StreamProvider] ${label} timed out after ${this.providerTimeoutMs}ms`);
        resolve(null);
      }, this.providerTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private isItalianHardsubServer(serverId: string): boolean {
    return serverId.startsWith("animeunity-") || serverId.startsWith("stellar-");
  }

  private pickDefaultServerIndex(servers: StreamServer[]): number {
    // 1. Prefer a non-Italian SUB server with soft English subtitles
    const cleanEngSub = servers.findIndex(
      (s) =>
        s.category === "SUB" &&
        !this.isItalianHardsubServer(s.id) &&
        s.subtitles &&
        s.subtitles.some((sub) => sub.lang === "en")
    );
    if (cleanEngSub !== -1) return cleanEngSub;

    // 2. Otherwise any non-Italian SUB server (e.g. AnimeHeaven English Hard-Sub)
    const cleanSub = servers.findIndex(
      (s) => s.category === "SUB" && !this.isItalianHardsubServer(s.id)
    );
    if (cleanSub !== -1) return cleanSub;

    // 3. Fallback to any SUB server
    const anySub = servers.findIndex((s) => s.category === "SUB");
    if (anySub !== -1) return anySub;

    return 0;
  }

  // ─── Main API ─────────────────────────────────────────────

  async getMultiStream(animeId: number, episode: number, forceFresh = false): Promise<MultiStreamResult> {
    const cacheKey = `multistream:${animeId}:${episode}`;
    if (!forceFresh) {
      const cached = streamCache.get<MultiStreamResult>(cacheKey);
      if (cached) {
        return cached;
      }
    } else {
      streamCache.del(cacheKey);
    }

    console.log(`[StreamProvider] Requesting streams for MAL ${animeId} ep ${episode}`);

    const meta = await this.getAnimeMetadata(animeId);
    if (!meta) {
      throw new Error(`Could not resolve anime metadata for ID ${animeId}.`);
    }

    console.log(
      `[StreamProvider] Resolved Metadata: "${meta.title}" | EN: "${meta.titleEnglish}" (${meta.year})`
    );

    const [kaaServers, ahServers, zokoServers, auServers] = await Promise.all([
      this.withProviderTimeout("KAA", this.fetchKAAServers(meta, episode)),
      this.withProviderTimeout("AnimeHeaven", this.fetchAnimeHeavenServers(meta, episode)),
      this.withProviderTimeout("ZokoAnime", this.fetchZokoServers(animeId, episode)),
      this.withProviderTimeout("AnimeUnity", this.fetchAnimeUnityServers(meta, episode)),
    ]);

    const subServers = [
      ...(kaaServers || []).filter((s) => s.category === "SUB"),
      ...(ahServers || []).filter((s) => s.category === "SUB"),
      ...(zokoServers || []).filter((s) => s.category === "SUB"),
      ...(auServers || []).filter((s) => s.category === "SUB"),
    ];
    const dubServers = [
      ...(kaaServers || []).filter((s) => s.category === "DUB"),
      ...(zokoServers || []).filter((s) => s.category === "DUB"),
    ];

    const allServers = [...subServers, ...dubServers];

    // If live scrapers yielded 0 servers, check verified known stream fallbacks
    if (allServers.length === 0) {
      const knownFallbacks = getKnownStreams(animeId, episode);
      if (knownFallbacks && knownFallbacks.length > 0) {
        console.log(
          `[StreamProvider] 🌟 Applied ${knownFallbacks.length} known fallback stream(s) for MAL ${animeId} ep ${episode}`
        );
        allServers.push(...knownFallbacks);
      }
    }

    console.log(
      `[StreamProvider] ✅ Resolved ${allServers.length} server(s): SUB=${subServers.length}, DUB=${dubServers.length}`
    );

    if (allServers.length === 0) {
      throw new Error(`No working streams found for "${meta.titleEnglish || meta.title}" episode ${episode}.`);
    }

    const result: MultiStreamResult = {
      servers: allServers,
      default: this.pickDefaultServerIndex(allServers),
    };

    // Only cache if we resolved full multi-server results (never cache degraded single-server states)
    if (allServers.length > 1) {
      streamCache.set(cacheKey, result);
    }
    return result;
  }

  async getStreamUrl(animeId: number, episode: number): Promise<StreamResult> {
    const multi = await this.getMultiStream(animeId, episode);
    const server = multi.servers[multi.default];
    return {
      url: server.url,
      type: server.type,
      quality: server.quality,
      headers: server.headers,
      subtitles: server.subtitles,
    };
  }
}

export default ConsumetStreamProvider;
