import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { History, Play, Trash2, Clock, Film, AlertTriangle } from "lucide-react";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import {
  getRecentLocalHistory,
  removeLocalEpisodeProgress,
  clearAllLocalHistory,
  isEpisodeFinished,
} from "@/lib/watchProgress";
import { Button } from "@/components/ui/button";
import { formatEpisodeNumber } from "@/lib/utils";

interface HistoryItem {
  id: string | number;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  episode_title?: string;
  progress_seconds: number;
  duration_seconds: number;
  updated_at?: number | string;
  isLocalOnly?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function HistoryPage() {
  const { history, loading, deleteEntry, clearHistory } = useWatchHistory();
  const [localHistory, setLocalHistory] = useState(() => getRecentLocalHistory());
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setLocalHistory(getRecentLocalHistory());
  }, []);

  // Merge local storage items and cloud database history into a deduplicated single anime list (showing latest watched episode)
  const combinedHistory = useMemo<HistoryItem[]>(() => {
    const map = new Map<number, HistoryItem>();

    // 1. Local history entries
    for (const item of localHistory) {
      if (item.durationSeconds > 0) {
        const existing = map.get(item.animeId);
        const existingTime = existing?.updated_at
          ? typeof existing.updated_at === "number"
            ? existing.updated_at
            : new Date(existing.updated_at).getTime()
          : 0;

        if (!existing || item.updatedAt > existingTime) {
          map.set(item.animeId, {
            id: `local-${item.animeId}-${item.episodeNumber}`,
            anime_id: item.animeId,
            anime_title: item.animeTitle || `Anime #${item.animeId}`,
            anime_image: item.animeImage || null,
            episode_number: item.episodeNumber,
            episode_title: `Episode ${item.episodeNumber}`,
            progress_seconds: item.progressSeconds,
            duration_seconds: item.durationSeconds,
            updated_at: item.updatedAt,
            isLocalOnly: true,
          });
        }
      }
    }

    // 2. Database history entries
    for (const h of history) {
      if (h.duration_seconds > 0) {
        const existing = map.get(h.anime_id);
        const hTime = h.watched_at ? new Date(h.watched_at).getTime() : 0;
        const existingTime = existing?.updated_at
          ? typeof existing.updated_at === "number"
            ? existing.updated_at
            : new Date(existing.updated_at).getTime()
          : 0;

        if (!existing) {
          map.set(h.anime_id, {
            id: h.id,
            anime_id: h.anime_id,
            anime_title: h.anime_title,
            anime_image: h.anime_image,
            episode_number: h.episode_number,
            episode_title: h.episode_title || `Episode ${h.episode_number}`,
            progress_seconds: h.progress_seconds,
            duration_seconds: h.duration_seconds,
            updated_at: h.watched_at,
            isLocalOnly: false,
          });
        } else if (h.episode_number === existing.episode_number) {
          // Merge database ID
          existing.id = h.id;
          existing.isLocalOnly = false;
        } else if (hTime > existingTime) {
          map.set(h.anime_id, {
            id: h.id,
            anime_id: h.anime_id,
            anime_title: h.anime_title,
            anime_image: h.anime_image || existing.anime_image,
            episode_number: h.episode_number,
            episode_title: h.episode_title || `Episode ${h.episode_number}`,
            progress_seconds: h.progress_seconds,
            duration_seconds: h.duration_seconds,
            updated_at: h.watched_at,
            isLocalOnly: false,
          });
        }
      }
    }

    // Sort by most recently watched first
    return Array.from(map.values()).sort((a, b) => {
      const tA =
        typeof a.updated_at === "number"
          ? a.updated_at
          : a.updated_at
          ? new Date(a.updated_at).getTime()
          : 0;
      const tB =
        typeof b.updated_at === "number"
          ? b.updated_at
          : b.updated_at
          ? new Date(b.updated_at).getTime()
          : 0;
      return tB - tA;
    });
  }, [history, localHistory]);

  const handleDeleteItem = async (item: HistoryItem) => {
    // 1. Remove local progress for all episodes of this anime
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`aniverse:progress:${item.anime_id}:`)) {
          localStorage.removeItem(key);
        }
      }
      localStorage.removeItem(`aniverse:lastWatched:${item.anime_id}`);
    } catch {
      // Ignore
    }
    removeLocalEpisodeProgress(item.anime_id, item.episode_number);
    setLocalHistory(getRecentLocalHistory());

    // 2. Remove cloud history entries for this anime
    const cloudEntries = history.filter((h) => h.anime_id === item.anime_id);
    for (const ce of cloudEntries) {
      if (ce.id) {
        await deleteEntry(ce.id);
      }
    }
  };

  const handleClearAll = async () => {
    clearAllLocalHistory();
    setLocalHistory([]);
    await clearHistory();
    setConfirmClear(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full space-y-6 flex-1 flex flex-col page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/20 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <History className="w-7 h-7 text-primary" />
            Watch History
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pick up right where you left off. Saved automatically across sessions.
          </p>
        </div>

        {combinedHistory.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-lg animate-fade-in">
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Clear all?
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs px-2.5"
                  onClick={handleClearAll}
                >
                  Yes, Clear
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-400/40"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear History
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading && combinedHistory.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-video bg-card rounded-xl" />
            ))}
          </div>
        ) : combinedHistory.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary/60 flex items-center justify-center border border-border">
              <Film className="w-7 h-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">No watch history yet</h2>
              <p className="text-xs text-muted-foreground/80 max-w-sm">
                Anime you watch will automatically show up here with your progress saved so you can resume anytime.
              </p>
            </div>
            <Button asChild className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold px-6 shadow-md shadow-primary/10">
              <Link to="/search">Explore Anime</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {combinedHistory.map((item) => {
              const progressPct = Math.min(
                100,
                Math.max(0, (item.progress_seconds / item.duration_seconds) * 100)
              );
              const finished = isEpisodeFinished(item.progress_seconds, item.duration_seconds);

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col bg-card rounded-xl overflow-hidden border border-border/40 shadow-sm hover:border-primary/50 transition-all card-hover"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/9] w-full relative overflow-hidden bg-muted">
                    <img
                      src={item.anime_image || "/placeholder-anime.jpg"}
                      alt={item.anime_title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Badge */}
                    <div className="absolute top-2.5 left-2.5 z-10 rounded-md bg-black/75 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                      {formatEpisodeNumber(item.episode_number)}
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteItem(item);
                      }}
                      className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-md bg-black/60 hover:bg-red-500/80 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Hover play button */}
                    <Link
                      to={`/watch/${item.anime_id}/${item.episode_number}`}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      </div>
                    </Link>

                    {/* Bottom Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                      <div
                        className={`h-full ${finished ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
                    <div>
                      <Link
                        to={`/anime/${item.anime_id}`}
                        className="text-sm font-semibold leading-tight line-clamp-1 text-foreground hover:text-primary transition-colors"
                        title={item.anime_title}
                      >
                        {item.anime_title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.episode_title || `Episode ${item.episode_number}`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-primary/70" />
                        {finished ? (
                          <span className="text-emerald-400 font-semibold">Completed</span>
                        ) : (
                          `${formatDuration(item.progress_seconds)} / ${formatDuration(item.duration_seconds)}`
                        )}
                      </span>
                      <Button
                        asChild
                        size="sm"
                        className="h-6 text-[10px] px-2.5 rounded-full bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/30 font-semibold"
                      >
                        <Link to={`/watch/${item.anime_id}/${item.episode_number}`}>
                          {finished ? "Rewatch" : "Resume"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
