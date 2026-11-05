// ============================================
// AniVerse — Shared TypeScript Types
// ============================================

export interface Anime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  rating: string | null;
  season: string | null;
  year: number | null;
  studios: Studio[];
  genres: Genre[];
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailer: {
    youtube_id: string | null;
    url: string | null;
  } | null;
  duration: string | null;
  source: string | null;
  aired: {
    from: string | null;
    to: string | null;
    string: string | null;
  } | null;
  broadcast?: {
    day?: string | null;
    time?: string | null;
    timezone?: string | null;
    string?: string | null;
  } | null;
  airing_at?: number | null;
  episode?: number | null;
  relations?: any[];
}

export interface Genre {
  mal_id: number;
  name: string;
  type: string;
}

export interface Studio {
  mal_id: number;
  name: string;
  type: string;
}

export interface AnimeSeason {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  image: string | null;
  year: number | null;
  format: string | null;
  episodes: number | null;
  status: string | null;
  season_label: string;
  season_number: number | null;
  is_current: boolean;
}

export interface Episode {
  mal_id: number;
  title: string | null;
  title_japanese: string | null;
  title_romanji: string | null;
  aired: string | null;
  filler: boolean;
  recap: boolean;
  episode_number: number;
}

export interface StreamSource {
  url: string;
  type: "hls" | "mp4";
  quality?: string;
  headers?: Record<string, string>;
}

export interface SubtitleTrack {
  id?: string;
  url: string;
  label: string;
  lang: string;
  type?: "vtt" | "srt" | "ssa" | "ass" | "json";
}

export interface StreamServer {
  id: string;
  name: string;
  category: string;   // "SUB" | "DUB" | "RAW"
  url: string;
  type: "hls" | "mp4";
  quality?: string;
  headers?: Record<string, string>;
  subtitles?: SubtitleTrack[];
  thumbnails?: string;
}

export interface MultiStreamResult {
  servers: StreamServer[];
  default: number;
  message?: string;    // error message when servers is empty
}

export interface WatchHistoryEntry {
  id: string;
  user_id: string;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  episode_title: string | null;
  progress_seconds: number;
  duration_seconds: number;
  watched_at: string;
}

export interface WatchlistEntry {
  id: string;
  user_id: string;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  anime_type: string | null;
  added_at: string;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
}

export interface UserProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}
