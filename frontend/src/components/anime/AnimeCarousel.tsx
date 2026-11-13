import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Anime } from "@/types";
import { AnimeCard } from "./AnimeCard";
import { SkeletonCard } from "../shared/SkeletonCard";
import { useLayout } from "@/contexts/LayoutContext";

interface AnimeCarouselProps {
  title: string;
  animeList: Anime[] | null;
  loading: boolean;
  viewMoreLink?: string;
}

export function AnimeCarousel({ title, animeList, loading, viewMoreLink }: AnimeCarouselProps) {
  const { tvMode } = useLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollLimits = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    setShowLeftArrow(el.scrollLeft > 10);
    // Add small tolerance (5px) for rounding issues on zoom/hidpi screens
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScrollLimits);
    // Run once on load/update
    checkScrollLimits();

    // Trigger check again when animeList loads or window resizes
    const handleResize = () => checkScrollLimits();
    window.addEventListener("resize", handleResize);

    return () => {
      el.removeEventListener("scroll", checkScrollLimits);
      window.removeEventListener("resize", handleResize);
    };
  }, [animeList, loading]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleCarouselKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!tvMode) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const container = scrollRef.current;
    if (!container) return;

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>("a[href], button")
    );
    if (focusables.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? focusables.indexOf(active) : -1;
    let nextIndex = 0;

    if (currentIndex === -1) {
      nextIndex = e.key === "ArrowRight" ? 0 : focusables.length - 1;
    } else if (e.key === "ArrowRight") {
      nextIndex = Math.min(focusables.length - 1, currentIndex + 1);
    } else {
      nextIndex = Math.max(0, currentIndex - 1);
    }

    if (nextIndex !== currentIndex) {
      e.preventDefault();
      const target = focusables[nextIndex];
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  if (!loading && (!animeList || animeList.length === 0)) {
    return null; // Don't render empty rows
  }

  const cardSizeClasses = tvMode
    ? "min-w-44 sm:min-w-52 md:min-w-56 w-44 sm:w-52 md:w-56"
    : "min-w-35 sm:min-w-45 md:min-w-50 w-35 sm:w-45 md:w-50";

  return (
    <div className="relative group/carousel my-8">
      {/* Title & View More */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {viewMoreLink && (
          <Link
            to={viewMoreLink}
            className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors group cursor-pointer"
          >
            <span>View More</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {/* Outer wrapper */}
      <div className="relative mx-0 md:-mx-4 px-4">
        {/* Left Arrow Button */}
        {showLeftArrow && (
          <button
            type="button"
            onClick={() => handleScroll("left")}
            aria-label={`Scroll ${title} left`}
            className={`absolute left-6 top-1/2 -translate-y-1/2 z-10 rounded-full glass border border-border/80 text-foreground flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 shadow-lg ${
              tvMode
                ? "w-12 h-12 opacity-85 hover:opacity-100"
                : "w-10 h-10 opacity-0 group-hover/carousel:opacity-100"
            }`}
          >
            <ChevronLeft className={tvMode ? "w-6 h-6" : "w-5 h-5"} />
          </button>
        )}

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          onKeyDown={handleCarouselKeyDown}
          className="flex gap-4 sm:gap-5 overflow-x-auto carousel-scroll py-2 scrollbar-none hide-scrollbar snap-x snap-mandatory"
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${cardSizeClasses} snap-start`}>
                  <SkeletonCard />
                </div>
              ))
            : animeList?.map((anime, index) => (
                <div
                  key={`${anime.mal_id}-${index}`}
                  className={`${cardSizeClasses} snap-start`}
                >
                  <AnimeCard anime={anime} />
                </div>
              ))}
        </div>

        {/* Right Arrow Button */}
        {showRightArrow && (
          <button
            type="button"
            onClick={() => handleScroll("right")}
            aria-label={`Scroll ${title} right`}
            className={`absolute right-6 top-1/2 -translate-y-1/2 z-10 rounded-full glass border border-border/80 text-foreground flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 shadow-lg ${
              tvMode
                ? "w-12 h-12 opacity-85 hover:opacity-100"
                : "w-10 h-10 opacity-0 group-hover/carousel:opacity-100"
            }`}
          >
            <ChevronRight className={tvMode ? "w-6 h-6" : "w-5 h-5"} />
          </button>
        )}
      </div>
    </div>
  );
}

export default AnimeCarousel;
