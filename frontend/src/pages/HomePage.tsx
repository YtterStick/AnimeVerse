import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrending, useTopAiring, usePopular } from "@/hooks/useAnime";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { HeroBanner } from "@/components/anime/HeroBanner";
import { AnimeCarousel } from "@/components/anime/AnimeCarousel";
import { formatEpisodeNumber } from "@/lib/utils";

export function HomePage() {
  const { user } = useAuth();
  const { data: trending, loading: trendingLoading } = useTrending();
  const { data: topAiring, loading: topAiringLoading } = useTopAiring();
  const { data: popular, loading: popularLoading } = usePopular();
  const { history } = useWatchHistory();

  // Filter history to get the latest progress for each anime
  const continueWatchingItems = history
    .reduce((acc: typeof history, current) => {
      const x = acc.find((item) => item.anime_id === current.anime_id);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [])
    // Exclude finished episodes (e.g. 90% progress or more)
    .filter((h) => h.progress_seconds / h.duration_seconds < 0.9)
    .slice(0, 8);

  return (
    <div className="flex flex-col w-full pb-16 page-enter">
      {/* Featured Anime Slideshow */}
      <HeroBanner trendingList={trending} loading={trendingLoading} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-4 mt-6">
        {/* Continue Watching Section (Auth Only) */}
        {user && continueWatchingItems.length > 0 && (
          <div className="relative my-8 animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-4 text-foreground px-4 md:px-0">
              Continue Watching
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 px-4 md:px-0">
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
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="text-xs font-semibold leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                        {item.anime_title}
                      </h3>
                      <p className="text-[10px] font-medium text-muted-foreground mt-1">
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
        <AnimeCarousel title="Trending Now" animeList={trending} loading={trendingLoading} />
        <AnimeCarousel title="Top Airing" animeList={topAiring} loading={topAiringLoading} />
        <AnimeCarousel title="Most Popular" animeList={popular} loading={popularLoading} />
      </div>
    </div>
  );
}

export default HomePage;
