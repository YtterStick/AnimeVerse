export interface StreamResult {
  url: string;
  type: "hls" | "mp4";
  quality?: string;
  headers?: Record<string, string>;
  subtitles?: SubtitleTrack[];
  thumbnails?: string;
}

export interface SubtitleTrack {
  id?: string;
  url: string;
  label: string;
  lang: string;
  type?: "vtt" | "srt" | "ssa" | "ass" | "json";
}

export interface SkipInterval {
  type: "op" | "ed" | "recap" | string;
  start: number;
  end: number;
  episodeLength: number;
  source?: "stream" | "aniskip" | "subtitles";
}

export interface StreamServer {
  id: string;            // unique identifier for the server
  name: string;          // e.g. "CatStream", "VidPlay"
  category: string;      // "SUB" | "DUB" | "RAW"
  url: string;
  type: "hls" | "mp4";
  quality?: string;
  headers?: Record<string, string>;
  subtitles?: SubtitleTrack[];
  thumbnails?: string;
  skips?: SkipInterval[];
}

export interface MultiStreamResult {
  servers: StreamServer[];
  default: number;       // index of suggested default server
  message?: string;      // optional info message
}

export interface StreamProvider {
  getStreamUrl(animeId: number, episode: number): Promise<StreamResult>;
  getMultiStream(animeId: number, episode: number, forceFresh?: boolean): Promise<MultiStreamResult>;
}
