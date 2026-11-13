import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, History, ChevronRight, X } from "lucide-react";
import { useTrending, useTopAiring, useNewlyReleased, usePopular } from "@/hooks/useAnime";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import {
  getRecentLocalHistory,
  isEpisodeFinished,
  removeLocalAnimeHistory,
} from "@/lib/watchProgress";
import { useToast } from "@/contexts/ToastContext";
import { HeroBanner } from "@/components/anime/HeroBanner";
import { AnimeCarousel } from "@/components/anime/AnimeCarousel";
import { EstimatedSchedule } from "@/components/anime/EstimatedSchedule";
import { formatEpisodeNumber } from "@/lib/utils";
import { useLayout } from "@/contexts/LayoutContext";

interface ContinueItem {
  id: string | number;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  episode_title?: string;
  progress_seconds: number;
  duration_seconds: number;
  cloudIds: string[];
}

export function HomePage() {
  const { tvMode } = useLayout();
  const { data: trending, loading: trendingLoading } = useTrending();
  const { data: newlyReleased, loading: newlyReleasedLoading } = useNewlyReleased();
  const { data: topAiring, loading: topAiringLoading } = useTopAiring();
  const { data: popular, loading: popularLoading } = usePopular();
  const { history, deleteEntry } = useWatchHistory();
  const toast = useToast();
  const [localHistory, setLocalHistory] = useState(() => getRecentLocalHistory());
  const [dismissedAnimeIds, setDismissedAnimeIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    document.title = "AniVerse — Watch Anime Free in HD";
    setLocalHistory(getRecentLocalHistory());
  }, []);

  // Merge local instant progress and cloud history into an accurate continue-watching list
  const continueWatchingItems = useMemo<ContinueItem[]>(() => {
    interface MergedEntry {
      id: string | number;
      anime_id: number;
      anime_title: string;
      anime_image: string | null;
      episode_number: number;
      episode_title?: string;
      progress_seconds: number;
      duration_seconds: number;
      updated_at: number;
      cloudIds: string[];
    }

    const map = new Map<number, MergedEntry>();

    // 1. Process local progress entries
    for (const item of localHistory) {
      if (!item || !item.animeId || !item.durationSeconds) continue;
      const existing = map.get(item.animeId);
      if (!existing || item.updatedAt > existing.updated_at || item.episodeNumber > existing.episode_number) {
        map.set(item.animeId, {
          id: `local-${item.animeId}-${item.episodeNumber}`,
          anime_id: item.animeId,
          anime_title: item.animeTitle || `Anime #${item.animeId}`,
          anime_image: item.animeImage || null,
          episode_number: item.episodeNumber,
          episode_title: `Episode ${item.episodeNumber}`,
          progress_seconds: item.progressSeconds,
          duration_seconds: item.durationSeconds,
          updated_at: item.updatedAt || 0,
          cloudIds: existing?.cloudIds || [],
        });
      }
    }

    // 2. Process cloud database history entries (for authenticated users)
    for (const h of history) {
      if (!h || !h.anime_id || !h.duration_seconds) continue;
      const hTime = h.watched_at ? new Date(h.watched_at).getTime() : 0;
      const existing = map.get(h.anime_id);
      const nextCloudIds = existing ? [...existing.cloudIds, String(h.id)] : [String(h.id)];

      // Cloud entry wins if there's no existing local entry, or cloud has newer timestamp, or cloud is further in episodes
      if (!existing || hTime > existing.updated_at || h.episode_number > existing.episode_number) {
        map.set(h.anime_id, {
          id: h.id,
          anime_id: h.anime_id,
          anime_title: h.anime_title,
          anime_image: h.anime_image || existing?.anime_image || null,
          episode_number: h.episode_number,
          episode_title: h.episode_title || `Episode ${h.episode_number}`,
          progress_seconds: h.progress_seconds,
          duration_seconds: h.duration_seconds,
          updated_at: hTime,
          cloudIds: nextCloudIds,
        });
      } else {
        existing.cloudIds = nextCloudIds;
      }
    }

    // Sort by latest watched timestamp (most recently watched first) and exclude dismissed cards
    const sorted = Array.from(map.values())
      .filter((item) => !dismissedAnimeIds.has(item.anime_id))
      .sort((a, b) => b.updated_at - a.updated_at);

    return sorted.slice(0, 8).map((item) => {
      // If the latest episode was finished (>95% or within 30s of end), prompt to continue with next episode
      const finished = isEpisodeFinished(item.progress_seconds, item.duration_seconds);
      if (finished) {
        return {
          id: `${item.id}-next`,
          anime_id: item.anime_id,
          anime_title: item.anime_title,
          anime_image: item.anime_image,
          episode_number: item.episode_number + 1,
          episode_title: `Episode ${item.episode_number + 1}`,
          progress_seconds: 0,
          duration_seconds: item.duration_seconds,
          cloudIds: item.cloudIds,
        };
      }
      return {
        id: item.id,
        anime_id: item.anime_id,
        anime_title: item.anime_title,
        anime_image: item.anime_image,
        episode_number: item.episode_number,
        episode_title: item.episode_title,
        progress_seconds: item.progress_seconds,
        duration_seconds: item.duration_seconds,
        cloudIds: item.cloudIds,
      };
    });
  }, [history, localHistory, dismissedAnimeIds]);

  const handleDismissContinueItem = async (
    e: React.MouseEvent,
    item: ContinueItem
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDismissedAnimeIds((prev) => new Set(prev).add(item.anime_id));
    removeLocalAnimeHistory(item.anime_id);
    setLocalHistory(getRecentLocalHistory());

    if (item.cloudIds.length > 0) {
      await Promise.allSettled(item.cloudIds.map((cid) => deleteEntry(cid)));
    }
    toast.info(`Removed "${item.anime_title}" from Continue Watching`);
  };

  return (
    <div className="flex flex-col w-full pb-16 page-enter">
      {/* Featured Anime Slideshow */}
      <HeroBanner trendingList={trending} loading={trendingLoading} />

      <div
        className={`mx-auto w-full space-y-4 mt-6 ${
          tvMode
            ? "max-w-[1600px] px-5 sm:px-8 lg:px-10"
            : "max-w-7xl px-4 sm:px-6 lg:px-8"
        }`}
      >
        {/* Continue Watching Section (Instant Local & Cloud Sync) */}
        {continueWatchingItems.length > 0 && (
          <div className="relative my-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4 px-4 md:px-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Continue Watching
              </h2>
              <Link
                to="/history"
                className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors"
              >
                View All History <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div
              className={`grid px-4 md:px-0 ${
                tvMode
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-5"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
              }`}
            >
              {continueWatchingItems.map((item) => {
                const progress = item.progress_seconds / item.duration_seconds;
                const progressPct = Math.min(100, Math.max(0, progress * 100));

                return (
                  <Link
                    key={item.id}
                    to={`/watch/${item.anime_id}/${item.episode_number}`}
                    className="group relative flex flex-col bg-card rounded-lg overflow-hidden border border-border/40 shadow-sm card-hover"
                  >
                    <div className="aspect-[16/9] w-full relative overflow-hidden bg-muted">
                      <img
                        src={item.anime_image || "/placeholder-anime.jpg"}
                        alt={item.anime_title}
                        className="w-full h-full object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                      {/* Dismiss / remove button (hidden unless hovered/focused in TV Mode) */}
                      <button
                        type="button"
                        onClick={(e) => handleDismissContinueItem(e, item)}
                        aria-label={`Remove ${item.anime_title} from Continue Watching`}
                        title="Remove from Continue Watching"
                        className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/75 hover:bg-red-500/90 text-white/90 hover:text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer shadow-md ${
                          tvMode
                            ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            : "opacity-85 sm:opacity-0 sm:group-hover:opacity-100"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className={tvMode ? "p-3.5" : "p-3"}>
                      <h3
                        className={`${
                          tvMode ? "text-sm" : "text-xs"
                        } font-semibold leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors`}
                      >
                        {item.anime_title}
                      </h3>
                      <p
                        className={`${
                          tvMode ? "text-xs" : "text-[10px]"
                        } font-medium text-muted-foreground mt-1`}
                      >
                        {formatEpisodeNumber(item.episode_number)} — {item.episode_title}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 bg-secondary w-full">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Anime Rows */}
        <AnimeCarousel
          title="Trending Now"
          animeList={trending}
          loading={trendingLoading}
          viewMoreLink="/search?category=trending"
        />
        <AnimeCarousel
          title="Newly Released"
          animeList={newlyReleased}
          loading={newlyReleasedLoading}
          viewMoreLink="/search?category=newly-released"
        />
        <AnimeCarousel
          title="Top Airing"
          animeList={topAiring}
          loading={topAiringLoading}
          viewMoreLink="/search?category=top-airing"
        />
        <AnimeCarousel
          title="Most Popular"
          animeList={popular}
          loading={popularLoading}
          viewMoreLink="/search?category=popular"
        />

        {/* Estimated Broadcast Schedule */}
        <EstimatedSchedule />
      </div>
    </div>
  );
}

export default HomePage;
