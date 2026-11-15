import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

export type TitleLanguage = "en" | "jp";

export interface TitleSource {
  mal_id?: number | null;
  anime_id?: number | null;
  title?: string | null;
  title_english?: string | null;
  title_japanese?: string | null;
  titles?: { type: string; title: string }[] | null;
  title_synonyms?: string[] | null;
  synonyms?: string[] | null;
}

interface CachedTitleEntry {
  en: string | null;
  jp: string | null;
}

interface TitleLanguageContextType {
  language: TitleLanguage;
  setLanguage: (lang: TitleLanguage) => void;
  toggleLanguage: () => void;
  formatTitle: (anime?: TitleSource | null) => string;
}

const STORAGE_KEY = "aniverse:title_lang";
const CACHE_STORAGE_KEY = "aniverse:title_cache_v2";
const ANILIST_URL = "https://graphql.anilist.co";

const TitleLanguageContext = createContext<TitleLanguageContextType | undefined>(undefined);

const ENGLISH_INDICATOR_WORDS = new Set([
  "the", "of", "in", "to", "and", "for", "with", "on", "at", "from", "by", "as",
  "my", "your", "our", "their", "her", "his", "you", "we", "they", "is", "are",
  "was", "be", "not", "this", "that", "who", "what", "how", "why", "when", "where",
  "all", "only", "just", "even", "into", "out", "up", "down", "over", "under",
  "after", "before", "about", "world", "life", "love", "girl", "boy", "high",
  "school", "story", "chronicles", "legend", "reincarnated", "another", "level",
  "leveling", "solo", "skill", "magic", "demon", "king", "hero", "princess",
  "prince", "villainess", "dragon", "sword", "adventure", "season", "part",
  "movie", "new", "dark", "light", "black", "white", "red", "blue", "gold",
  "silver", "star", "sky", "time", "day", "night", "war", "battle", "god",
  "angel", "devil", "witch", "knight", "guild", "dungeon", "monster", "slime",
  "strongest", "secret", "class", "academy", "detective", "ghost", "spirit",
  "vampire", "hunter", "slayer", "alchemist", "bride", "sister", "brother",
  "family", "friend", "friends", "club", "way", "saga", "tale", "diary",
  "diaries", "flower", "fragrant", "blooms", "dignity", "box", "wind", "breaker",
  "apothecary", "beyond", "journey", "end", "delicious", "shield", "rising",
  "eminence", "shadow", "jobless", "reincarnation", "rascal", "dream", "bunny",
  "quintessential", "rent", "girlfriend", "boyfriend", "spy", "chainsaw", "man",
  "paradise", "heavenly", "delusion", "undead", "unluck", "muscles", "lock",
  "voice", "name", "weathering", "castle", "totoro", "fire", "force", "soul",
  "eater", "clover", "fairy", "tail", "seven", "deadly", "sins", "online",
  "starting", "wrong", "pick", "rock", "recoil", "ranking", "kings", "eternity",
  "promised", "neverland", "made", "abyss", "land", "golden", "grand", "prison",
  "food", "ordinary", "daily", "lives", "plastic", "memories", "beats", "summer",
  "rendering", "garden", "sinners", "house", "maid", "butler", "mage", "saint",
  "duke", "empire", "kingdom", "heaven", "hell", "death", "kill", "blood",
  "curse", "blade", "heart", "hope", "future", "past", "memory", "shadows",
  "nightmare", "wolf", "cat", "dog", "fox", "bear", "tiger", "crown", "throne",
  "ring", "gate", "tower", "island", "city", "town", "village", "room", "cafe",
  "shop", "game", "games", "player", "quest", "revenge", "awakening", "return",
  "rebirth", "origin", "final", "first", "last", "true", "false", "great",
  "little", "small", "big", "young", "old", "sweet", "bitter", "cold", "hot",
  "rain", "snow", "moon", "sun", "sea", "ocean", "forest", "winter", "spring",
  "autumn", "fall", "book", "song", "music", "dance", "doctor", "teacher",
  "student", "students", "master", "servant", "daughter", "son", "mother",
  "father", "wife", "husband", "lover", "lovers", "wants", "need", "needs",
  "can", "cannot", "cant", "will", "would", "should", "could", "must", "never",
  "always", "sometimes", "hides",
]);

const NON_ENGLISH_WORDS_RE =
  /\b(der|das|und|ein|eine|mein|dein|mit|von|les|des|une|est|pour|dans|sur|avec|los|las|del|con|por|para|una|uno|sobre|entre)\b/i;

const ROMAJI_PARTICLE_CHAIN_RE = /(?:^|\s)[A-Za-z][a-z']*\s+(?:no|wa|ga|wo|ni|kara|made)\s+[A-Z]/;

const ROMAJI_LOWERCASE_MARKER_RE =
  /\b(wa|ga|wo|kara|made|tachi|monogatari|densetsu|bouken|mahou|maou|yuusha|tensei|zoku|gekijouban|shoujo|shounen|boku|watashi|ore|kimi|kanojo|sekai|jinsei|gakuen|koukou|saikyou|saijaku|meikyuu|akuyaku|reijou|shinigami|shokugeki|kimetsu|shingeki)\b|\b[a-z]+-(?:hen|ki|shou)\b/;

/**
 * Checks whether a string appears to be Japanese Romaji rather than an English translation.
 */
export function looksLikeJapaneseRomaji(title?: string | null): boolean {
  if (!title) return false;
  return ROMAJI_PARTICLE_CHAIN_RE.test(title) || ROMAJI_LOWERCASE_MARKER_RE.test(title);
}

/**
 * Extracts a likely English title from AniList `synonyms` or Jikan `title_synonyms`
 * when `title_english` is null.
 */
export function extractEnglishTitleFromSynonyms(
  synonyms?: (string | null | undefined)[] | null,
  romajiTitle?: string | null
): string | null {
  if (!Array.isArray(synonyms) || synonyms.length === 0) return null;
  const romajiLower = (romajiTitle || "").trim().toLowerCase();

  for (const raw of synonyms) {
    const candidate = (raw || "").trim();
    if (candidate.length < 4) continue;
    if (romajiLower && candidate.toLowerCase() === romajiLower) continue;
    // Skip short all-caps acronyms (e.g. "AoT", "JJK", "KNY")
    if (/^[A-Z0-9!?.:\-\s]{1,6}$/.test(candidate)) continue;
    // Require Latin characters only (reject CJK/Kana/Hangul/Cyrillic)
    if (/[^\u0020-\u024F\u2010-\u2027]/.test(candidate)) continue;
    // Reject obvious accented Romance/Germanic titles (e.g. Spanish/French/Portuguese)
    if (/[àâäçêëîïôöùûüÿñáíóú¿¡ãõäöüß]/i.test(candidate)) continue;
    if (NON_ENGLISH_WORDS_RE.test(candidate)) continue;
    if (looksLikeJapaneseRomaji(candidate)) continue;

    const words = candidate.toLowerCase().match(/[a-z']+/g) || [];
    const hasEnglishWord = words.some((w) => ENGLISH_INDICATOR_WORDS.has(w));
    if (hasEnglishWord) {
      return candidate;
    }
  }
  return null;
}

function stripSeasonSuffix(title: string): string {
  return title
    .replace(/\s*(?::|-|—)?\s*(?:Season|Dai)\s*\d+.*$/i, "")
    .replace(/\s+\d+(?:st|nd|rd|th)\s*Season.*$/i, "")
    .replace(/\s*(?::|-|—)?\s*(?:Part|Cour)\s*\d+.*$/i, "")
    .replace(/\s*(?::|-|—)?\s*(?:The\s+)?Final\s*Season.*$/i, "")
    .replace(/\s*(?::|-|—)?\s*(?:Ichi|Ni|San|Yon|Go)\s+no\s+Shou.*$/i, "")
    .replace(/\s+(?:II|III|IV|V|VI)\b.*$/, "")
    .trim();
}

export function translateJapaneseSeasonSuffix(suffix: string): string {
  return suffix
    .replace(/\bIchi\s+no\s+Shou\b/gi, "Season 1")
    .replace(/\bNi\s+no\s+Shou\b/gi, "Season 2")
    .replace(/\bSan\s+no\s+Shou\b/gi, "Season 3")
    .replace(/\bYon\s+no\s+Shou\b/gi, "Season 4")
    .replace(/\bGo\s+no\s+Shou\b/gi, "Season 5")
    .replace(/\bDai\s*(\d+)-?ki\b/gi, "Season $1")
    .replace(/\bKanketsu-?hen\b/gi, "Final Chapter")
    .replace(/\bGekijouban\b/gi, "The Movie")
    .replace(/\bZoku-?hen\b/gi, "Sequel")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Derives an English title for a sequel, prequel, or spin-off whose own `title.english` is null
 * by matching its Romaji franchise prefix against related entries that have an English title.
 */
export function deriveEnglishFromRelations(
  romajiTitle: string | null | undefined,
  edges?: any[] | null
): string | null {
  if (!romajiTitle || !Array.isArray(edges) || edges.length === 0) return null;
  const trimmedRomaji = romajiTitle.trim();
  const romajiLower = trimmedRomaji.toLowerCase();

  // Prefer prequel / parent / main_story links over sequels or side stories
  const priorityOrder: Record<string, number> = {
    PARENT: 0,
    MAIN_STORY: 1,
    PREQUEL: 2,
    ALTERNATIVE: 3,
    SEQUEL: 4,
    SIDE_STORY: 5,
  };
  const sortedEdges = [...edges].sort(
    (a, b) =>
      (priorityOrder[String(a?.relationType || "").toUpperCase()] ?? 9) -
      (priorityOrder[String(b?.relationType || "").toUpperCase()] ?? 9)
  );

  for (const edge of sortedEdges) {
    const node = edge?.node;
    if (!node) continue;
    const nodeRomaji = (node.title?.romaji || "").trim();
    const nodeEnglish =
      (node.title?.english || "").trim() ||
      extractEnglishTitleFromSynonyms(node.synonyms, nodeRomaji) ||
      "";
    if (!nodeRomaji || !nodeEnglish) continue;

    const baseRomaji = stripSeasonSuffix(nodeRomaji);
    const baseEnglish = stripSeasonSuffix(nodeEnglish) || nodeEnglish;
    if (baseRomaji.length < 4) continue;

    const baseRomajiLower = baseRomaji.toLowerCase();
    if (romajiLower.startsWith(baseRomajiLower)) {
      const nextChar = trimmedRomaji.charAt(baseRomaji.length);
      if (!nextChar || /[\s:\-/!]/.test(nextChar)) {
        const rawRemainder = trimmedRomaji.slice(baseRomaji.length).trim();
        const cleanedRemainder = rawRemainder.replace(/^[:\-/]+\s*/, "").trim();
        if (!cleanedRemainder) return baseEnglish;
        const translatedSuffix = translateJapaneseSeasonSuffix(cleanedRemainder);
        return `${baseEnglish}: ${translatedSuffix}`;
      }
    }
  }

  return null;
}

/**
 * Synchronously resolves an English title from the fields already attached to an Anime/TitleSource object.
 */
export function resolveDirectEnglishTitle(anime?: TitleSource | null): string | null {
  if (!anime) return null;
  if (anime.title_english && anime.title_english.trim()) {
    return anime.title_english.trim();
  }
  if (Array.isArray(anime.titles)) {
    const englishEntry = anime.titles.find(
      (t) => String(t?.type || "").toLowerCase() === "english" && t?.title?.trim()
    );
    if (englishEntry) return englishEntry.title.trim();
  }
  const synEn = extractEnglishTitleFromSynonyms(
    anime.title_synonyms || anime.synonyms,
    anime.title
  );
  return synEn || null;
}

function loadTitleCache(): Record<number, CachedTitleEntry> {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistTitleCache(nextCache: Record<number, CachedTitleEntry>) {
  try {
    // Cap persisted cache size to 600 entries to stay well within localStorage quota
    const keys = Object.keys(nextCache);
    if (keys.length > 600) {
      const trimmed: Record<number, CachedTitleEntry> = {};
      for (const k of keys.slice(-500)) {
        const numKey = Number(k);
        trimmed[numKey] = nextCache[numKey];
      }
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(nextCache));
    }
  } catch {
    // Ignore quota / private browsing errors
  }
}

export function TitleLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<TitleLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "jp") return saved;
    } catch {
      // Ignore
    }
    return "en";
  });

  const [titleCache, setTitleCache] = useState<Record<number, CachedTitleEntry>>(() =>
    loadTitleCache()
  );
  const requestedIdsRef = useRef<Set<number>>(
    new Set(Object.keys(titleCache).map((k) => Number(k)))
  );
  const pendingIdsRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const commitBatchEntries = useCallback((updates: Record<number, CachedTitleEntry>) => {
    if (!mountedRef.current || Object.keys(updates).length === 0) return;
    setTitleCache((prev) => {
      const next = { ...prev, ...updates };
      persistTitleCache(next);
      return next;
    });
  }, []);

  const flushPendingLookups = useCallback(async () => {
    const ids = Array.from(pendingIdsRef.current);
    pendingIdsRef.current.clear();
    if (ids.length === 0) return;

    // Chunk AniList batch queries at up to 50 MAL IDs per request
    const unresolvedForJikan: number[] = [];
    const batchUpdates: Record<number, CachedTitleEntry> = {};

    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      try {
        const query = `
          query ($ids: [Int]) {
            Page(perPage: 50) {
              media(idMal_in: $ids, type: ANIME) {
                idMal
                title { romaji english native }
                synonyms
                relations {
                  edges {
                    relationType(version: 2)
                    node {
                      idMal
                      title { romaji english }
                      synonyms
                    }
                  }
                }
              }
            }
          }
        `;
        const res = await fetch(ANILIST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables: { ids: chunk } }),
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const mediaList: any[] = json?.data?.Page?.media || [];
        const returnedIds = new Set<number>();

        for (const m of mediaList) {
          const malId = Number(m?.idMal);
          if (!malId) continue;
          returnedIds.add(malId);
          const romaji = (m.title?.romaji || "").trim() || null;
          const resolvedEn =
            (m.title?.english || "").trim() ||
            extractEnglishTitleFromSynonyms(m.synonyms, romaji) ||
            deriveEnglishFromRelations(romaji, m.relations?.edges) ||
            null;

          batchUpdates[malId] = {
            en: resolvedEn || romaji,
            jp: romaji || m.title?.native || resolvedEn,
          };

          if (!resolvedEn && romaji && looksLikeJapaneseRomaji(romaji)) {
            unresolvedForJikan.push(malId);
          }
        }

        // Fallback to Jikan for any ID not returned by AniList
        for (const id of chunk) {
          if (!returnedIds.has(id)) {
            unresolvedForJikan.push(id);
          }
        }
      } catch {
        // Ignore transient network errors; keep entries marked in requestedIdsRef for this session
      }
    }

    commitBatchEntries(batchUpdates);

    // Secondary Jikan lookup (throttled, capped per batch) for remaining Japanese-only AniList entries
    const jikanUpdates: Record<number, CachedTitleEntry> = {};
    for (const malId of unresolvedForJikan.slice(0, 6)) {
      if (!mountedRef.current) break;
      try {
        await new Promise((r) => setTimeout(r, 400));
        const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const item = json?.data;
        if (!item) continue;
        const jikanEn =
          resolveDirectEnglishTitle(item) || batchUpdates[malId]?.en || null;
        const jikanJp = (item.title || "").trim() || batchUpdates[malId]?.jp || null;
        if (jikanEn || jikanJp) {
          jikanUpdates[malId] = { en: jikanEn, jp: jikanJp };
        }
      } catch {
        // Ignore Jikan timeouts/rate-limits
      }
    }
    commitBatchEntries(jikanUpdates);
  }, [commitBatchEntries]);

  const queueLookup = useCallback(
    (malId: number) => {
      if (!malId || isNaN(malId) || malId <= 0) return;
      if (requestedIdsRef.current.has(malId)) return;
      requestedIdsRef.current.add(malId);
      pendingIdsRef.current.add(malId);
      if (flushTimerRef.current !== null) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        void flushPendingLookups();
      }, 60);
    },
    [flushPendingLookups]
  );

  const setLanguage = useCallback((lang: TitleLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: TitleLanguage = prev === "en" ? "jp" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const formatTitle = useCallback(
    (anime?: TitleSource | null): string => {
      if (!anime) return "";
      const malId = Number(anime.mal_id || anime.anime_id || 0);
      const directEn = resolveDirectEnglishTitle(anime);
      const cached = malId > 0 ? titleCache[malId] : undefined;

      // Trigger background resolution when English title is missing, or when a stub
      // (such as Watchlist or Continue Watching) lacks native/English title metadata in JP mode.
      const isMetadataStub = !anime.title_japanese && anime.title_english == null && !anime.titles;
      if (malId > 0 && !cached && ((!directEn && language === "en") || isMetadataStub)) {
        queueLookup(malId);
      }

      if (language === "jp") {
        return (
          cached?.jp ||
          anime.title ||
          anime.title_japanese ||
          directEn ||
          "Unknown Title"
        );
      }

      return (
        directEn ||
        cached?.en ||
        anime.title ||
        anime.title_japanese ||
        "Unknown Title"
      );
    },
    [language, queueLookup, titleCache]
  );

  return (
    <TitleLanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        formatTitle,
      }}
    >
      {children}
    </TitleLanguageContext.Provider>
  );
}

export function useTitleLanguage() {
  const ctx = useContext(TitleLanguageContext);
  if (!ctx) {
    throw new Error("useTitleLanguage must be used within a TitleLanguageProvider");
  }
  return ctx;
}
