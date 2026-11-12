import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Plus, Check, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Anime } from "@/types";
import { useWatchlist } from "@/hooks/useWatchHistory";
import { truncateText, formatScore } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useTitleLanguage } from "@/contexts/TitleLanguageContext";
import { useToast } from "@/contexts/ToastContext";

interface HeroBannerProps {
  trendingList: Anime[] | null;
  loading: boolean;
}

export function HeroBanner({ trendingList, loading }: HeroBannerProps) {
  const navigate = useNavigate();
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const { formatTitle } = useTitleLanguage();
  const toast = useToast();
  const [activeIndex, setActiveIndex] = useState(0);

  const bannerList = trendingList?.slice(0, 5) || [];

  useEffect(() => {
    if (bannerList.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % bannerList.length);
    }, 8000); // Rotate every 8 seconds

    return () => clearInterval(interval);
  }, [bannerList.length]);

  if (loading || bannerList.length === 0) {
    return (
      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[75vh] min-h-[480px] bg-black overflow-hidden border-b border-border/20 flex items-end">
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-card/10 skeleton-shimmer" />

        {/* Content Container Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-10 md:pb-16 z-20 space-y-4 animate-pulse">
          {/* Badge Rows */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 bg-muted/40 rounded-full" />
            <Skeleton className="h-6 w-20 bg-muted/40 rounded-full" />
          </div>

          {/* Anime Title */}
          <Skeleton className="h-10 sm:h-14 w-3/4 md:w-1/2 bg-muted/50 rounded-lg" />

          {/* Synopsis Excerpt */}
          <div className="space-y-2 max-w-xl">
            <Skeleton className="h-4 w-full bg-muted/30" />
            <Skeleton className="h-4 w-5/6 bg-muted/30" />
            <Skeleton className="h-4 w-2/3 bg-muted/30" />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="h-11 w-32 bg-muted/40 rounded-full" />
            <Skeleton className="h-11 w-32 bg-muted/40 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const currentAnime = bannerList[activeIndex];
  const title = formatTitle(currentAnime);
  const bannerImage = currentAnime.images?.webp?.large_image_url || currentAnime.images?.jpg?.large_image_url;
  const synopsis = currentAnime.synopsis || "No synopsis available.";
  const rating = currentAnime.rating;
  const score = currentAnime.score;

  const isSaved = isInWatchlist(currentAnime.mal_id);

  const handlePlayClick = () => {
    navigate(`/watch/${currentAnime.mal_id}/1`);
  };

  const handleWatchlistClick = async () => {
    try {
      if (isSaved) {
        await removeFromWatchlist(currentAnime.mal_id);
        toast.info(`Removed "${title}" from Watchlist`);
      } else {
        await addToWatchlist({
          anime_id: currentAnime.mal_id,
          anime_title: currentAnime.title,
          anime_image: currentAnime.images?.webp?.image_url || currentAnime.images?.jpg?.image_url,
          anime_type: currentAnime.type,
        });
        toast.success(`Added "${title}" to Watchlist`);
      }
    } catch {
      toast.error("Couldn't update your watchlist. Please try again.");
    }
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + bannerList.length) % bannerList.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % bannerList.length);
  };

  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[75vh] min-h-[480px] bg-black overflow-hidden border-b border-border/20 group">
      {/* Background Image with horizontal and vertical gradients */}
      <div className="absolute inset-0">
        <img
          src={bannerImage}
          alt={title}
          className="w-full h-full object-cover object-top opacity-50 md:opacity-60 scale-105 animate-fade-in filter blur-[1px] md:blur-0"
          key={activeIndex} // Force re-render image to animate
        />
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/20 to-transparent hidden md:block" />
      </div>

      {/* Slide Navigation Controls */}
      <button
        onClick={handlePrev}
        aria-label="Previous featured anime"
        className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-25 p-2 rounded-full glass border border-border/60 text-foreground hover:bg-primary hover:text-white cursor-pointer hover:border-primary opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={handleNext}
        aria-label="Next featured anime"
        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-25 p-2 rounded-full glass border border-border/60 text-foreground hover:bg-primary hover:text-white cursor-pointer hover:border-primary opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Content Container */}
      <div className="absolute inset-0 flex items-end">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-10 md:pb-16 z-20 space-y-4">
          {/* Badge Rows */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold" key={`meta-${activeIndex}`}>
            {score && (
              <span className="px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-primary text-white border border-primary/20 shadow-md">
                <Star className="w-3.5 h-3.5 fill-white" />
                {formatScore(score)}
              </span>
            )}
            {rating && (
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/80 text-foreground border border-border/40">
                {rating}
              </span>
            )}
            {currentAnime.type && (
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/80 text-foreground border border-border/40">
                {currentAnime.type}
              </span>
            )}
          </div>

          {/* Anime Title */}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl line-clamp-2 leading-tight drop-shadow-md drop-shadow-black/20"
            key={`title-${activeIndex}`}
          >
            {title}
          </h1>

          {/* Synopsis Excerpt */}
          <p
            className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed line-clamp-3 text-balance drop-shadow-sm"
            key={`synopsis-${activeIndex}`}
          >
            {truncateText(synopsis, 250)}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handlePlayClick}
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.03]"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              Watch Now
            </Button>
            <Button
              variant="outline"
              onClick={handleWatchlistClick}
              className="rounded-full px-6 py-5 border-border/60 hover:bg-secondary text-foreground flex items-center gap-2 transition-all transform hover:scale-[1.03]"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-primary" />
                  In Watchlist
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add to List
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Carousel dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {bannerList.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
              i === activeIndex ? "bg-primary w-6" : "bg-muted hover:bg-muted/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroBanner;
