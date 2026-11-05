import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layers, ChevronLeft, ChevronRight, Play, Check } from "lucide-react";
import { useAnimeSeasons } from "@/hooks/useAnime";
import { useTitleLanguage } from "@/contexts/TitleLanguageContext";
import type { AnimeSeason } from "@/types";

interface AnimeSeasonsProps {
  currentAnimeId: number;
  mode?: "watch" | "detail";
  className?: string;
}

export function AnimeSeasons({
  currentAnimeId,
  mode = "watch",
  className = "",
}: AnimeSeasonsProps) {
  const { data: seasons, loading } = useAnimeSeasons(currentAnimeId);
  const { language } = useTitleLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScrollLimits = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 10);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScrollLimits);
    checkScrollLimits();

    const handleResize = () => checkScrollLimits();
    window.addEventListener("resize", handleResize);

    return () => {
      el.removeEventListener("scroll", checkScrollLimits);
      window.removeEventListener("resize", handleResize);
    };
  }, [seasons, loading]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // If there are no seasons or only 1 standalone entry, hide the section
  if (!loading && (!seasons || seasons.length <= 1)) {
    return null;
  }

  return (
    <div className={`relative group/seasons pt-6 border-t border-border/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-0.5">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Seasons &amp; Franchise</span>
            {seasons && seasons.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {seasons.length} Releases
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            Watch Season 1, Season 2, and related sequels in release order
          </p>
        </div>

        {/* Carousel Scroll Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleScroll("left")}
            disabled={!showLeftArrow}
            aria-label="Scroll left"
            className="w-8 h-8 rounded-full border border-border/50 bg-secondary/60 hover:bg-primary hover:text-white hover:border-primary disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll("right")}
            disabled={!showRightArrow}
            aria-label="Scroll right"
            className="w-8 h-8 rounded-full border border-border/50 bg-secondary/60 hover:bg-primary hover:text-white hover:border-primary disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto carousel-scroll py-2 scrollbar-none hide-scrollbar snap-x snap-mandatory"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="min-w-[150px] sm:min-w-[190px] w-[150px] sm:w-[190px] shrink-0 rounded-xl overflow-hidden bg-card/40 border border-border/30 p-2 space-y-2 animate-pulse"
              >
                <div className="aspect-[2/3] w-full bg-secondary/60 rounded-lg" />
                <div className="h-3 bg-secondary/80 rounded w-3/4" />
                <div className="h-2.5 bg-secondary/50 rounded w-1/2" />
              </div>
            ))
          : seasons?.map((season: AnimeSeason) => {
              const isCurrent = season.is_current || season.mal_id === currentAnimeId;
              const isUnreleased =
                season.status === "NOT_YET_RELEASED" ||
                (!season.episodes && season.year && season.year >= new Date().getFullYear());
              const title =
                language === "en"
                  ? season.title_english || season.title
                  : season.title_japanese || season.title;
              const linkTo =
                mode === "watch"
                  ? isCurrent
                    ? undefined
                    : isUnreleased
                    ? `/anime/${season.mal_id}`
                    : `/watch/${season.mal_id}/1`
                  : `/anime/${season.mal_id}`;

              const CardContent = (
                <div
                  className={`group relative flex flex-col h-full rounded-xl overflow-hidden transition-all duration-300 ${
                    isCurrent
                      ? "bg-primary/10 border-2 border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30"
                      : "bg-card/50 border border-border/40 hover:border-primary/60 hover:bg-secondary/40 hover:scale-[1.02] cursor-pointer"
                  }`}
                >
                  {/* Poster Image */}
                  <div className="aspect-[2/3] w-full relative overflow-hidden bg-muted">
                    <img
                      src={season.image || "/placeholder-anime.jpg"}
                      alt={title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Season Label Badge (Top Left) */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      {isCurrent ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 bg-primary text-white border border-white/20 shadow-md shadow-primary/30 ring-1 ring-primary/40 backdrop-blur-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          {season.season_label} (Current)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/80 text-white border border-white/10 backdrop-blur-sm">
                          {season.season_label}
                        </span>
                      )}

                      {season.format && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-black/75 text-gray-300 border border-white/10 backdrop-blur-sm">
                          {season.format}
                        </span>
                      )}
                    </div>

                    {/* Hover Play Button (when not current) */}
                    {!isCurrent && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4
                        className={`text-xs font-bold leading-tight line-clamp-2 transition-colors ${
                          isCurrent
                            ? "text-primary"
                            : "text-foreground group-hover:text-primary"
                        }`}
                        title={title}
                      >
                        {title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 font-medium">
                        {season.year ? `${season.year}` : ""}
                        {season.episodes ? ` • ${season.episodes} Eps` : ""}
                        {season.status === "RELEASING"
                          ? " • Airing"
                          : season.status === "NOT_YET_RELEASED"
                          ? " • Upcoming"
                          : ""}
                      </p>
                    </div>

                    {/* Status / Call-to-action */}
                    <div className="mt-2.5 pt-2 border-t border-border/20 flex items-center justify-between text-[11px]">
                      {isCurrent ? (
                        <span className="text-[10px] font-extrabold text-primary flex items-center gap-1 uppercase tracking-wide">
                          <Check className="w-3.5 h-3.5" />
                          {mode === "watch" ? "Now Watching" : "Viewing"}
                        </span>
                      ) : isUnreleased ? (
                        <span className="text-[10px] font-bold text-amber-300 group-hover:text-amber-200 flex items-center gap-0.5 transition-colors">
                          Upcoming Details
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary flex items-center gap-0.5 transition-colors">
                          {mode === "watch" ? "Play Season" : "View"}
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              return (
                <div
                  key={season.mal_id}
                  className="min-w-[150px] sm:min-w-[190px] w-[150px] sm:w-[190px] shrink-0 snap-start"
                >
                  {linkTo ? (
                    <Link to={linkTo} className="block h-full">
                      {CardContent}
                    </Link>
                  ) : (
                    CardContent
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}

export default AnimeSeasons;

