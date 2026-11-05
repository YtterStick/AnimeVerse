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
