import { useParams, Link } from "react-router-dom";
import { Star, Clock, Calendar, Heart, Play, AlertCircle, Sparkles } from "lucide-react";
import { useAnimeDetail, useAnimeEpisodes } from "@/hooks/useAnime";
import { useWatchlist } from "@/hooks/useWatchHistory";
import { EpisodeList } from "@/components/anime/EpisodeList";
import { GenreBadge } from "@/components/anime/GenreBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatScore } from "@/lib/utils";
import { useTitleLanguage } from "@/contexts/TitleLanguageContext";

export function AnimePage() {
  const { id } = useParams<{ id: string }>();
  const animeId = parseInt(id || "", 10);

  const { anime, loading: detailLoading, error: detailError } = useAnimeDetail(animeId);
  const { episodes, loading: episodesLoading } = useAnimeEpisodes(animeId);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const { formatTitle, language } = useTitleLanguage();

  const isUpcoming =
    anime?.status === "Not yet aired" ||
    anime?.status === "Upcoming" ||
    anime?.status === "NOT_YET_RELEASED";

  if (detailLoading) {
    return (
      <div className="w-full pb-16 animate-pulse">
        {/* Detail Banner Backdrop Skeleton */}
        <div className="relative w-full h-[30vh] sm:h-[40vh] bg-card/30" />

        {/* Main Content Info Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-32 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            {/* Left Column */}
            <div className="space-y-6">
              <Skeleton className="w-full aspect-[2/3] rounded-xl bg-card border border-border/30" />
              <div className="bg-card/50 border border-border/40 rounded-xl p-5 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-border/10 pb-2 last:border-0 last:pb-0">
                    <Skeleton className="h-4 w-12 bg-card" />
                    <Skeleton className="h-4 w-20 bg-card" />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-3 space-y-8 pt-4 lg:pt-0">
              <div className="space-y-4">
                <Skeleton className="h-4 w-24 bg-card" />
                <Skeleton className="h-12 w-3/4 bg-card" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 bg-card" />
                  <Skeleton className="h-6 w-16 bg-card" />
                  <Skeleton className="h-6 w-16 bg-card" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Skeleton className="h-11 w-36 bg-card rounded-full" />
                  <Skeleton className="h-11 w-36 bg-card rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <Skeleton className="h-6 w-20 bg-card" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-card" />
                  <Skeleton className="h-4 w-full bg-card" />
                  <Skeleton className="h-4 w-3/4 bg-card" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (detailError || !anime) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Failed to load anime details</h2>
        <p className="text-sm text-muted-foreground">{detailError || "Anime not found."}</p>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white rounded-full">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  const title = formatTitle(anime);
  const image = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url;
  const bannerImage = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url;
  const synopsis = anime.synopsis || "No synopsis available.";
  const studioName = anime.studios?.[0]?.name || "Unknown Studio";

  const isSaved = isInWatchlist(anime.mal_id);

  const handleWatchlistToggle = async () => {
    try {
      if (isSaved) {
        await removeFromWatchlist(anime.mal_id);
      } else {
        await addToWatchlist({
          anime_id: anime.mal_id,
          anime_title: anime.title_english || anime.title,
          anime_image:
            anime.images?.webp?.large_image_url ||
            anime.images?.jpg?.large_image_url ||
            anime.images?.webp?.image_url ||
            anime.images?.jpg?.image_url ||
            null,
          anime_type: anime.type,
        });
      }
    } catch {
      window.alert("Couldn't update your watchlist. Please try again.");
    }
  };

  return (
    <div className="w-full pb-16 page-enter">
      {/* Detail Banner Backdrop */}
      <div className="relative w-full h-[30vh] sm:h-[40vh] bg-black overflow-hidden border-b border-border/20">
        <img
          src={bannerImage}
          alt={title}
          className="w-full h-full object-cover object-top opacity-30 blur-md scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Main Content Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Left Column - Poster & Metadata Panel */}
          <div className="space-y-6">
            {/* Poster Card */}
            <div className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl border border-border bg-card">
              <img src={image} alt={title} className="w-full h-full object-cover" />
            </div>

            {/* Quick Details List */}
            <div className="bg-card/50 border border-border/40 rounded-xl p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between py-1 border-b border-border/20">
                <span className="text-muted-foreground">Type</span>
                <span className="font-semibold text-foreground">{anime.type || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/20">
                <span className="text-muted-foreground">Episodes</span>
                <span className="font-semibold text-foreground">{anime.episodes || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/20">
                <span className="text-muted-foreground">Studio</span>
                <span className="font-semibold text-foreground">{studioName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/20">
                <span className="text-muted-foreground">Rating</span>
                <span className="font-semibold text-foreground text-right line-clamp-1 max-w-[150px]">{anime.rating || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/20">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-foreground">{anime.status || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Aired</span>
                <span className="font-semibold text-foreground text-right line-clamp-1 max-w-[150px]">{anime.aired?.string || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Right Column - Title, Synopsis, and Episode Grid */}
          <div className="lg:col-span-3 space-y-8 pt-4 lg:pt-0">
            {/* Headers */}
            <div className="space-y-4">
              {/* Secondary Alternate Title Header */}
              {(() => {
                const altTitle =
                  language === "en"
                    ? anime.title_japanese || anime.title
                    : anime.title_japanese || anime.title_english;
                return (
                  altTitle && altTitle !== title && (
                    <p className="text-xs sm:text-sm font-semibold tracking-wider text-primary uppercase line-clamp-1">
                      {altTitle}
                    </p>
                  )
                );
              })()}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-none">
                {title}
              </h1>

              {/* Badges details */}
              <div className="flex flex-wrap items-center gap-2">
                {anime.score && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 bg-primary text-white border border-primary/20 shadow-md">
                    <Star className="w-3.5 h-3.5 fill-white" />
                    {formatScore(anime.score)}
                  </span>
                )}
                {isUpcoming && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Upcoming Release
                  </span>
                )}
                {anime.duration && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/80 text-foreground border border-border/40 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {anime.duration}
                  </span>
                )}
                {anime.year && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/80 text-foreground border border-border/40 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {anime.year} {anime.season && `• ${anime.season}`}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!isUpcoming ? (
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 shadow-lg shadow-primary/10 transition-all font-semibold"
                  >
                    <Link to={`/watch/${anime.mal_id}/1`}>
                      <Play className="w-4 h-4 mr-2 fill-white" />
                      Watch Episode 1
                    </Link>
                  </Button>
                ) : anime.trailer?.url ? (
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 shadow-lg shadow-primary/10 transition-all font-semibold"
                  >
                    <a href={anime.trailer.url} target="_blank" rel="noopener noreferrer">
                      <Play className="w-4 h-4 mr-2 fill-white" />
                      Watch Official Trailer
                    </a>
                  </Button>
                ) : null}
                <Button
                  variant={isUpcoming ? "default" : "outline"}
                  onClick={handleWatchlistToggle}
                  className={`rounded-full px-6 py-5 border flex items-center gap-2 transition-all cursor-pointer ${
                    isSaved
                      ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 shadow-sm shadow-primary/20"
                      : isUpcoming
                      ? "bg-primary hover:bg-primary/90 text-white border-transparent"
                      : "border-border/60 hover:bg-secondary text-foreground"
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Heart className="w-4 h-4 fill-primary text-primary" />
                      <span className="font-semibold text-primary">In Watchlist</span>
                    </>
                  ) : (
                    <>
                      <Heart className={`w-4 h-4 ${isUpcoming ? "fill-white" : ""}`} />
                      <span>Add to Watchlist</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Upcoming Notice Card */}
              {isUpcoming && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-200">
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-amber-300">Scheduled Upcoming Release</p>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      This title is not yet released ({anime.aired?.string || anime.season || "Release Date TBA"}). Keep it saved to your Watchlist so you won&apos;t miss the premiere!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Synopsis */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">Synopsis</h2>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line text-justify">
                {synopsis}
              </p>
              
              {/* Genres Badge row */}
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {anime.genres.map((genre) => (
                    <GenreBadge key={genre.mal_id} name={genre.name} />
                  ))}
                </div>
              )}
            </div>

            {/* Episodes List Grid */}
            <div className="space-y-4 pt-4 border-t border-border/30">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white tracking-tight">Episodes</h2>
                {!isUpcoming && episodesLoading && episodes.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading episodes...
                  </span>
                )}
              </div>

              {isUpcoming ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-card/40 border border-border/40 space-y-2">
                  <Calendar className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-white">Broadcast Has Not Started</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Episodes will become available here once the series officially begins broadcasting ({anime.aired?.string || anime.season || "Release Date TBA"}).
                  </p>
                </div>
              ) : (
                <EpisodeList
                  animeId={anime.mal_id}
                  episodes={episodes}
                  loading={episodesLoading}
                  animeImage={image}
                />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default AnimePage;
