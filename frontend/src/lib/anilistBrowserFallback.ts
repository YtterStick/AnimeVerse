import type { Anime, AnimeSeason, ApiResponse, Episode } from "@/types";

const ANILIST_URL = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  description(asHtml: false)
  format
  episodes
  nextAiringEpisode { episode airingAt }
  status
  averageScore
  popularity
  favourites
  season
  seasonYear
  duration
  source
  genres
  isAdult
  startDate { year month day }
  endDate { year month day }
  coverImage { extraLarge large medium }
  bannerImage
  trailer { id site }
  studios(isMain: true) { nodes { id name } }
`;

const STATIC_GENRES: { id: number; name: string }[] = [
  { id: 1, name: "Action" },
  { id: 2, name: "Adventure" },
  { id: 4, name: "Comedy" },
  { id: 8, name: "Drama" },
  { id: 10, name: "Fantasy" },
  { id: 14, name: "Horror" },
  { id: 7, name: "Mystery" },
  { id: 22, name: "Romance" },
  { id: 24, name: "Sci-Fi" },
  { id: 36, name: "Slice of Life" },
  { id: 30, name: "Sports" },
  { id: 37, name: "Supernatural" },
  { id: 41, name: "Suspense" },
  { id: 40, name: "Psychological" },
  { id: 18, name: "Mecha" },
  { id: 19, name: "Music" },
  { id: 62, name: "Isekai" },
];

const ID_TO_GENRE: Record<number, string> = Object.fromEntries(
  STATIC_GENRES.map((g) => [g.id, g.name])
);

const BASE_ANILIST_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
]);

function stripHtml(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function mapStatus(status: string | null | undefined): string {
  switch (status) {
    case "RELEASING":
      return "Currently Airing";
    case "FINISHED":
      return "Finished Airing";
    case "NOT_YET_RELEASED":
      return "Not yet aired";
    default:
      return status || "Unknown";
  }
}

export function mapAniListToAnime(m: any): Anime {
  const large = m.coverImage?.extraLarge || m.coverImage?.large || "";
  const med = m.coverImage?.large || m.coverImage?.medium || large;
  const small = m.coverImage?.medium || med;
  const eps =
    m.episodes ||
    (m.nextAiringEpisode?.episode && m.nextAiringEpisode.episode > 1
      ? m.nextAiringEpisode.episode - 1
      : null);

  return {
    mal_id: m.idMal || m.id,
    images: {
      jpg: { image_url: med, small_image_url: small, large_image_url: large },
      webp: { image_url: med, small_image_url: small, large_image_url: large },
    },
    trailer:
      m.trailer?.site === "youtube" && m.trailer?.id
        ? {
            youtube_id: m.trailer.id,
            url: `https://www.youtube.com/watch?v=${m.trailer.id}`,
          }
        : { youtube_id: null, url: null },
    title: m.title?.romaji || m.title?.english || "Unknown Title",
    title_english: m.title?.english || null,
    title_japanese: m.title?.native || null,
    type: m.format || "TV",
    source: m.source ? String(m.source).replace(/_/g, " ") : null,
    episodes: eps,
    status: mapStatus(m.status),
    aired: {
      from: m.startDate?.year ? String(m.startDate.year) : null,
      to: m.endDate?.year ? String(m.endDate.year) : null,
      string: m.startDate?.year ? String(m.startDate.year) : "N/A",
    },
    duration: m.duration ? `${m.duration} min per ep` : null,
    rating: m.isAdult ? "R+" : "PG-13",
    score: m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : null,
    scored_by: m.popularity || null,
    rank: null,
    popularity: m.popularity || null,
    members: m.popularity || null,
    synopsis: stripHtml(m.description),
    season: m.season ? String(m.season).toLowerCase() : null,
    year: m.seasonYear || m.startDate?.year || null,
    studios: (m.studios?.nodes || []).map((s: any) => ({
      mal_id: s.id,
      type: "anime",
      name: s.name,
    })),
    genres: (m.genres || []).map((g: string, idx: number) => ({
      mal_id: idx + 1,
      type: "anime",
      name: g,
    })),
  };
}

async function queryAniListBrowser(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    throw new Error(`AniList browser fallback HTTP ${res.status}`);
  }
  const json = await res.json();
  return json?.data;
}

function getNewlyReleasedDateBounds(): {
  startDate_greater: number;
  startDate_lesser: number;
} {
  const now = new Date();
  const minYear = now.getUTCFullYear() - 1;
  const maxDate =
    now.getUTCFullYear() * 10000 +
    (now.getUTCMonth() + 1) * 100 +
    Math.min(31, now.getUTCDate() + 1);
  return {
    startDate_greater: minYear * 10000,
    startDate_lesser: maxDate,
  };
}

export async function fetchMediaListFallback(
  sort: string[],
  page = 1,
  perPage = 25,
  extraVars: Record<string, unknown> = {}
): Promise<ApiResponse<Anime[]>> {
  const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $status_in: [MediaStatus], $format: MediaFormat, $format_in: [MediaFormat], $search: String, $genre_in: [String], $tag_in: [String], $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $popularity_greater: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total perPage currentPage lastPage hasNextPage }
        media(type: ANIME, isAdult: false, sort: $sort, status: $status, status_in: $status_in, format: $format, format_in: $format_in, search: $search, genre_in: $genre_in, tag_in: $tag_in, startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, popularity_greater: $popularity_greater) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await queryAniListBrowser(query, { page, perPage, sort, ...extraVars });
  const pageInfo = data?.Page?.pageInfo || {};
  const list = (data?.Page?.media || [])
    .filter((m: any) => m && (m.idMal || m.id))
    .map(mapAniListToAnime);

  const hasNext = list.length === perPage && Boolean(pageInfo.hasNextPage);
  const lastPage = !hasNext
    ? Math.max(1, page)
    : pageInfo.total && pageInfo.total < 5000
    ? Math.max(page, Math.ceil(pageInfo.total / perPage))
    : page + 1;

  return {
    data: list,
    pagination: {
      last_visible_page: lastPage,
      has_next_page: hasNext,
      current_page: pageInfo.currentPage || page,
      items: {
        count: list.length,
        total: pageInfo.total || list.length,
        per_page: perPage,
      },
    },
  };
}

export const anilistBrowserFallback = {
  trending: (page = 1) =>
    fetchMediaListFallback(["TRENDING_DESC", "POPULARITY_DESC"], page, 25, {
      status: "RELEASING",
    }),

  topAiring: (page = 1) =>
    fetchMediaListFallback(["SCORE_DESC", "POPULARITY_DESC"], page, 25, {
      status: "RELEASING",
    }),

  upcoming: (page = 1) =>
    fetchMediaListFallback(["POPULARITY_DESC", "TRENDING_DESC"], page, 25, {
      status: "NOT_YET_RELEASED",
    }),

  newlyReleased: (page = 1) =>
    fetchMediaListFallback(["START_DATE_DESC", "POPULARITY_DESC"], page, 25, {
      status_in: ["RELEASING", "FINISHED"],
      format_in: ["TV", "MOVIE", "ONA", "OVA"],
      ...getNewlyReleasedDateBounds(),
      popularity_greater: 800,
    }),

  movies: (page = 1) =>
    fetchMediaListFallback(["POPULARITY_DESC", "SCORE_DESC"], page, 25, {
      format: "MOVIE",
      status_in: ["RELEASING", "FINISHED"],
    }),

  popular: (page = 1) => fetchMediaListFallback(["POPULARITY_DESC"], page, 25),

  topRated: (page = 1) =>
    fetchMediaListFallback(["SCORE_DESC", "POPULARITY_DESC"], page, 25),

  search: (query: string, page = 1, genres = "", orderBy = "", status = "", type = "") => {
    const extraVars: Record<string, unknown> = {};
    if (query.trim()) extraVars.search = query.trim();
    const normStatus = status.toLowerCase();
    if (normStatus === "airing") extraVars.status = "RELEASING";
    else if (normStatus === "upcoming") extraVars.status = "NOT_YET_RELEASED";
    else if (normStatus === "complete" || normStatus === "completed") extraVars.status = "FINISHED";

    const normType = type.toLowerCase();
    if (normType === "tv") extraVars.format = "TV";
    else if (normType === "movie") extraVars.format = "MOVIE";
    else if (normType === "ova") extraVars.format = "OVA";
    else if (normType === "special") extraVars.format = "SPECIAL";

    if (normType === "movie" && !extraVars.status && !query.trim()) {
      extraVars.status_in = ["RELEASING", "FINISHED"];
    }

    const isNewlyReleased = orderBy === "newly-released" || orderBy === "start_date";
    if (isNewlyReleased) {
      if (!extraVars.status) extraVars.status_in = ["RELEASING", "FINISHED"];
      if (!extraVars.format) extraVars.format_in = ["TV", "MOVIE", "ONA", "OVA"];
      Object.assign(extraVars, getNewlyReleasedDateBounds());
      if (!query.trim() && !genres) extraVars.popularity_greater = 500;
    }

    if (genres) {
      const genreIn: string[] = [];
      const tagIn: string[] = [];
      for (const token of genres.split(",").map((s) => s.trim()).filter(Boolean)) {
        const num = parseInt(token, 10);
        const name = !isNaN(num) && ID_TO_GENRE[num] ? ID_TO_GENRE[num] : token;
        if (BASE_ANILIST_GENRES.has(name)) genreIn.push(name);
        else if (name.toLowerCase() === "suspense") genreIn.push("Thriller");
        else tagIn.push(name);
      }
      if (genreIn.length) extraVars.genre_in = genreIn;
      if (tagIn.length) extraVars.tag_in = tagIn;
    }

    const sort =
      orderBy === "score"
        ? ["SCORE_DESC", "POPULARITY_DESC"]
        : orderBy === "trending"
        ? ["TRENDING_DESC", "POPULARITY_DESC"]
        : isNewlyReleased
        ? ["START_DATE_DESC", "POPULARITY_DESC"]
        : ["POPULARITY_DESC", "SCORE_DESC"];

    return fetchMediaListFallback(sort, page, 25, extraVars);
  },

  schedule: async (day = "monday"): Promise<ApiResponse<Anime[]>> => {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const targetIdx = dayMap[day.toLowerCase()] ?? 1;
    const now = new Date();
    const diff = targetIdx - now.getUTCDay();
    const targetDate = new Date(now);
    targetDate.setUTCDate(now.getUTCDate() + diff);
    targetDate.setUTCHours(0, 0, 0, 0);
    const start = Math.floor(targetDate.getTime() / 1000) - 86400;
    const end = start + 2 * 86400;

    const query = `
      query ($start: Int, $end: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            airingAt
            episode
            media { ${MEDIA_FIELDS} countryOfOrigin }
          }
        }
      }
    `;
    const data = await queryAniListBrowser(query, { start, end });
    const prefix = day.slice(0, 3).toLowerCase();
    const list = (data?.Page?.airingSchedules || [])
      .filter((item: any) => {
        if (!item?.media?.idMal || item?.media?.isAdult) return false;
        if (item?.media?.countryOfOrigin && item.media.countryOfOrigin !== "JP") return false;
        const d = new Date(item.airingAt * 1000);
        const jst = d
          .toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Tokyo" })
          .toLowerCase();
        return jst === prefix;
      })
      .map((item: any) => ({
        ...mapAniListToAnime(item.media),
        airing_at: item.airingAt ?? null,
        episode: item.episode ?? null,
      }));

    return {
      data: list,
      pagination: {
        last_visible_page: 1,
        has_next_page: false,
        current_page: 1,
        items: { count: list.length, total: list.length, per_page: 50 },
      },
    };
  },

  genres: async (): Promise<{ data: { id: number; name: string }[] }> => ({
    data: STATIC_GENRES,
  }),

  byId: async (id: number): Promise<{ data: Anime }> => {
    try {
      const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${id}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (jikanRes.ok) {
        const json = await jikanRes.json();
        if (json?.data) return { data: json.data as Anime };
      }
    } catch {
      // Fall through to AniList
    }
    const data = await queryAniListBrowser(
      `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${MEDIA_FIELDS} } }`,
      { idMal: id }
    );
    if (!data?.Media) throw new Error("Anime not found");
    return { data: mapAniListToAnime(data.Media) };
  },

  episodes: async (id: number): Promise<ApiResponse<Episode[]>> => {
    const data = await queryAniListBrowser(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          episodes
          nextAiringEpisode { episode }
          streamingEpisodes { title }
        }
      }`,
      { idMal: id }
    );
    const m = data?.Media;
    const titleMap = new Map<number, string>();
    for (const se of m?.streamingEpisodes || []) {
      const match = String(se.title || "").match(/Episode\s+(\d+)\s*[-–:]?\s*(.*)/i);
      if (match) {
        const epNum = parseInt(match[1], 10);
        if (!isNaN(epNum)) titleMap.set(epNum, match[2]?.trim() || `Episode ${epNum}`);
      }
    }
    const airedCount = m?.nextAiringEpisode?.episode
      ? Math.max(1, m.nextAiringEpisode.episode - 1)
      : m?.episodes || titleMap.size || 12;
    const total = Math.max(airedCount, titleMap.size, 1);
    const eps: Episode[] = [];
    for (let i = 1; i <= total; i++) {
      eps.push({
        mal_id: i,
        title: titleMap.get(i) || `Episode ${i}`,
        title_japanese: null,
        title_romanji: null,
        aired: null,
        filler: false,
        recap: false,
        episode_number: i,
      });
    }
    return {
      data: eps,
      pagination: {
        last_visible_page: 1,
        has_next_page: false,
        current_page: 1,
        items: { count: eps.length, total: eps.length, per_page: eps.length },
      },
    };
  },

  recommendations: async (id: number): Promise<ApiResponse<any[]>> => {
    const data = await queryAniListBrowser(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          recommendations(perPage: 15, sort: [RATING_DESC]) {
            nodes {
              rating
              mediaRecommendation {
                idMal
                title { romaji english }
                coverImage { extraLarge large medium }
              }
            }
          }
        }
      }`,
      { idMal: id }
    );
    const nodes = data?.Media?.recommendations?.nodes || [];
    const mapped = nodes
      .filter((n: any) => n?.mediaRecommendation?.idMal)
      .map((n: any) => {
        const rec = n.mediaRecommendation;
        const img =
          rec.coverImage?.extraLarge || rec.coverImage?.large || rec.coverImage?.medium || "";
        return {
          entry: {
            mal_id: rec.idMal,
            title: rec.title?.english || rec.title?.romaji || "Anime",
            images: {
              jpg: { image_url: img, small_image_url: img, large_image_url: img },
              webp: { image_url: img, small_image_url: img, large_image_url: img },
            },
          },
          votes: n.rating || 1,
        };
      });
    return { data: mapped };
  },

  seasons: async (id: number): Promise<ApiResponse<AnimeSeason[]>> => {
    const data = await queryAniListBrowser(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          idMal format status episodes seasonYear
          startDate { year }
          coverImage { large medium }
          title { english romaji native }
          relations {
            edges {
              relationType(version: 2)
              node {
                idMal type format status episodes seasonYear
                startDate { year }
                coverImage { large medium }
                title { english romaji native }
              }
            }
          }
        }
      }`,
      { idMal: id }
    );
    const root = data?.Media;
    if (!root) return { data: [] };

    const items: AnimeSeason[] = [
      {
        mal_id: root.idMal || id,
        title: root.title?.romaji || root.title?.english || "Main Series",
        title_english: root.title?.english || null,
        title_japanese: root.title?.native || null,
        image: root.coverImage?.large || root.coverImage?.medium || null,
        year: root.seasonYear || root.startDate?.year || null,
        format: root.format || "TV",
        episodes: root.episodes || null,
        status: mapStatus(root.status),
        season_label: "Current",
        season_number: 1,
        is_current: true,
      },
    ];

    for (const edge of root.relations?.edges || []) {
      const n = edge?.node;
      if (!n?.idMal || n.type !== "ANIME" || edge.relationType === "CHARACTER") continue;
      if (!items.some((x) => x.mal_id === n.idMal)) {
        items.push({
          mal_id: n.idMal,
          title: n.title?.romaji || n.title?.english || "Related",
          title_english: n.title?.english || null,
          title_japanese: n.title?.native || null,
          image: n.coverImage?.large || n.coverImage?.medium || null,
          year: n.seasonYear || n.startDate?.year || null,
          format: n.format || "TV",
          episodes: n.episodes || null,
          status: mapStatus(n.status),
          season_label: String(edge.relationType || "RELATED").replace(/_/g, " "),
          season_number: null,
          is_current: false,
        });
      }
    }
    return { data: items };
  },
};
