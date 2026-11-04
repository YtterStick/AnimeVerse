import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Check, AlertCircle } from "lucide-react";
import type { Episode } from "@/types";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { getLocalEpisodeProgress } from "@/lib/watchProgress";

interface EpisodeListProps {
  animeId: number;
  episodes: Episode[];
  loading: boolean;
  currentEpisodeNumber?: number;
  animeImage?: string;
}

const CHUNK_SIZE = 50;

export function EpisodeList({
  animeId,
  episodes,
  loading,
  currentEpisodeNumber,
  animeImage,
}: EpisodeListProps) {
  const { history } = useWatchHistory();
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  // Helper to check if user has watched this episode
  const getProgress = (epNum: number) => {
    const local = getLocalEpisodeProgress(animeId, epNum);
    if (local && local.durationSeconds > 0) {
      return local.progressSeconds / local.durationSeconds;
    }
    const record = history.find(
      (h) => h.anime_id === animeId && h.episode_number === epNum
    );
    if (!record || !record.duration_seconds) return null;
    return record.progress_seconds / record.duration_seconds;
  };

  // Compute episode ranges of 50 episodes
  const ranges = useMemo(() => {
    const list: [number, number][] = [];
    const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      const start = sorted[i].episode_number;
      const end = sorted[Math.min(i + CHUNK_SIZE - 1, sorted.length - 1)].episode_number;
      list.push([start, end]);
    }
    return list;
  }, [episodes]);

  // Auto-select range containing current episode
  useEffect(() => {
    if (ranges.length > 0 && currentEpisodeNumber) {
      const idx = ranges.findIndex(([s, e]) => currentEpisodeNumber >= s && currentEpisodeNumber <= e);
      if (idx !== -1) setActiveRangeIndex(idx);
    }
  }, [currentEpisodeNumber, ranges]);

  // Filter episodes for the active range
  const displayedEpisodes = useMemo(() => {
    const range = ranges[activeRangeIndex];
    const filtered = range
      ? episodes.filter((ep) => ep.episode_number >= range[0] && ep.episode_number <= range[1])
      : episodes;
    return [...filtered].sort((a, b) => a.episode_number - b.episode_number);
  }, [episodes, ranges, activeRangeIndex]);

  if (loading && episodes.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-card/40 skeleton-shimmer border border-border/20" />
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card/20 rounded-xl border border-border/40 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">No episodes listed yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Episodes might not be populated on the external index.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category Tabs */}
      {ranges.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-card/30 border border-border/30">
          {ranges.map(([start, end], idx) => (
            <button
              key={idx}
              onClick={() => setActiveRangeIndex(idx)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer border ${
                idx === activeRangeIndex
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-secondary/60 text-muted-foreground border-border/30 hover:text-foreground hover:bg-secondary"
              }`}
            >
              {start} – {end}
            </button>
          ))}
          {/* Loading indicator for more episodes */}
          {loading && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-muted-foreground/60 italic">
              <span className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full animate-spin" />
              Loading more...
            </span>
          )}
        </div>
      )}

      {/* Episode Grid or List */}
      {episodes.length <= 12 ? (
        /* Detailed Episode Layout (For small counts e.g. <= 12) */
        <div className="flex flex-col gap-3 max-w-4xl animate-fade-in">
          {displayedEpisodes.map((ep) => {
            const isCurrent = currentEpisodeNumber === ep.episode_number;
            const progress = getProgress(ep.episode_number);
            const isWatched = progress !== null && progress >= 0.9;

            return (
              <Link
                key={ep.episode_number}
                to={`/watch/${animeId}/${ep.episode_number}`}
                className={`group flex items-center gap-4 p-3.5 rounded-xl border transition-all duration-200 select-none ${
                  isCurrent
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-card hover:bg-secondary/40 hover:border-border/80 border-border/40"
                }`}
              >
                {/* Left: Thumbnail/Poster */}
                <div className="w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-muted/20 relative shrink-0 border border-border/20">
                  <img
                    src={animeImage || "/placeholder-anime.jpg"}
                    alt={ep.title || `Episode ${ep.episode_number}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                  {/* Duration / EP Badge */}
                  <span className="absolute bottom-1 right-1 bg-black/85 text-[9px] font-bold px-1.5 py-0.5 rounded text-white tracking-wider border border-white/5">
                    EP {ep.episode_number}
                  </span>
                  
                  {/* Watch Progress bar */}
                  {progress !== null && progress > 0 && progress < 0.9 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Right: Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase ${
                      isCurrent ? "bg-primary/20 text-primary border border-primary/20" : "bg-secondary text-muted-foreground"
                    }`}>
                      Episode {ep.episode_number}
                    </span>
                    {ep.filler && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded border border-amber-500/20 uppercase tracking-wider">
                        Filler
                      </span>
                    )}
                    {ep.recap && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/20 text-blue-500 rounded border border-blue-500/20 uppercase tracking-wider">
                        Recap
                      </span>
                    )}
                    {isWatched && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Watched
                      </span>
                    )}
                  </div>

                  <h3 className={`text-sm sm:text-base font-bold leading-tight truncate group-hover:text-primary transition-colors ${
                    isCurrent ? "text-primary" : "text-white"
                  }`}>
                    {ep.title || `Episode ${ep.episode_number}`}
                  </h3>

                  {ep.aired && (
                    <p className="text-[11px] text-muted-foreground/80 font-medium">
                      Aired: {new Date(ep.aired).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Standard Episode Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 animate-fade-in">
          {displayedEpisodes.map((ep) => {
            const isCurrent = currentEpisodeNumber === ep.episode_number;
            const progress = getProgress(ep.episode_number);
            const isWatched = progress !== null && progress >= 0.9;

            return (
              <Link
                key={ep.episode_number}
                to={`/watch/${animeId}/${ep.episode_number}`}
                className={`group relative flex flex-col justify-between p-3 rounded-lg border text-left transition-all duration-200 select-none ${
                  isCurrent
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-card hover:bg-secondary/60 hover:border-border/80 border-border/40"
                }`}
              >
                {/* Top row */}
                <div className="flex justify-between items-start gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
                      isCurrent ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    EP {ep.episode_number}
                  </span>

                  {isWatched && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Title */}
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className={`text-xs font-medium leading-snug line-clamp-1 flex-1 group-hover:text-primary transition-colors ${
                    isCurrent ? "text-primary" : "text-foreground"
                  }`}>
                    {ep.title || `Episode ${ep.episode_number}`}
                  </span>
                  <Play className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>

                {/* Watch Progress Bar */}
                {progress !== null && progress > 0 && progress < 0.9 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-b-lg overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EpisodeList;
