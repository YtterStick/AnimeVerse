import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  useAnimeSearch,
  usePopular,
  useTopRated,
  useTopAiring,
} from "@/hooks/useAnime";
import { AnimeGrid } from "@/components/anime/AnimeGrid";
import { Pagination } from "@/components/shared/Pagination";
import {
  Search,
  SlidersHorizontal,
  X,
  Flame,
  Star,
  Radio,
  Sparkles,
  Check,
  RotateCcw,
  ChevronRight,
  Swords,
  Compass,
  Laugh,
  Film,
  Skull,
  Heart,
  Rocket,
  Coffee,
  Trophy,
  Eye,
  Zap,
  Brain,
  Bot,
  DoorOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const POPULAR_GENRES = [
  { id: 1, name: "Action", icon: Swords },
  { id: 2, name: "Adventure", icon: Compass },
  { id: 4, name: "Comedy", icon: Laugh },
  { id: 8, name: "Drama", icon: Film },
  { id: 10, name: "Fantasy", icon: Sparkles },
  { id: 14, name: "Horror", icon: Skull },
  { id: 7, name: "Mystery", icon: Search },
  { id: 22, name: "Romance", icon: Heart },
  { id: 24, name: "Sci-Fi", icon: Rocket },
  { id: 36, name: "Slice of Life", icon: Coffee },
  { id: 30, name: "Sports", icon: Trophy },
  { id: 37, name: "Supernatural", icon: Eye },
  { id: 41, name: "Suspense", icon: Zap },
  { id: 40, name: "Psychological", icon: Brain },
  { id: 18, name: "Mecha", icon: Bot },
  { id: 62, name: "Isekai", icon: DoorOpen },
];

export const CATEGORY_CONFIG: Record<
  string,
  {
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  trending: {
    title: "Trending Anime Now",
    subtitle: "What fans are buzzing about and streaming right now worldwide",
    badge: "Trending",
    icon: Flame,
  },
  "top-airing": {
    title: "Top Airing Series",
    subtitle: "Highest ranked ongoing broadcasts released this season",
    badge: "Top Airing",
    icon: Radio,
  },
  popular: {
    title: "Most Popular Anime",
    subtitle: "All-time most watched, favorited, and legendary masterpieces",
    badge: "Most Popular",
    icon: Flame,
  },
  "top-rated": {
    title: "Top Rated Masterpieces",
    subtitle: "Critically acclaimed, all-time highest scoring anime in history",
    badge: "Top Rated",
    icon: Star,
  },
};

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract 'q', 'genres', 'category', and 'page' query parameters from URL
  const queryParams = new URLSearchParams(location.search);
  const urlQuery = queryParams.get("q") || "";
  const urlGenresRaw = queryParams.get("genres") || "";
  const urlCategory = queryParams.get("category") || "";
  const urlPage = Math.max(1, parseInt(queryParams.get("page") || "1", 10));

  const selectedGenres = useMemo(() => {
    return urlGenresRaw
      ? urlGenresRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }, [urlGenresRaw]);

  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const [showGenreFilter, setShowGenreFilter] = useState(true);

  // Sync state with URL when it changes
  useEffect(() => {
    setSearchTerm(urlQuery);
  }, [urlQuery]);

  const hasFilters =
    urlQuery.trim().length > 0 ||
    selectedGenres.length > 0 ||
    Boolean(urlCategory) ||
    urlPage > 1;

  // Paginated Search & Category Hook
  const {
    data: searchResults,
    pagination,
    loading: searchLoading,
    error: searchError,
  } = useAnimeSearch(urlQuery, selectedGenres.join(","), urlPage, urlCategory);

  // Discover showcase hooks (active when in default overview mode)
  const { data: popularList, loading: popularLoading } = usePopular();
  const { data: topRatedList, loading: topRatedLoading } = useTopRated();
  const { data: topAiringList, loading: topAiringLoading } = useTopAiring();

  const updateSearch = (
    newQuery: string,
    newGenres: string[],
    newPage = 1,
    newCategory = urlCategory
  ) => {
    const params = new URLSearchParams();
    if (newQuery.trim()) {
      params.set("q", newQuery.trim());
    }
    if (newGenres.length > 0) {
      params.set("genres", newGenres.join(","));
    }
    if (newCategory) {
      params.set("category", newCategory);
    }
    if (newPage > 1) {
      params.set("page", String(newPage));
    }
    const qs = params.toString();
    navigate(qs ? `/search?${qs}` : "/search");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch(searchTerm, selectedGenres, 1, urlCategory);
  };

  const toggleGenre = (genreName: string) => {
    const isSelected = selectedGenres.includes(genreName);
    const nextGenres = isSelected
      ? selectedGenres.filter((g) => g !== genreName)
      : [...selectedGenres, genreName];
    updateSearch(searchTerm, nextGenres, 1, urlCategory);
  };

  const removeGenre = (genreName: string) => {
    const nextGenres = selectedGenres.filter((g) => g !== genreName);
    updateSearch(searchTerm, nextGenres, 1, urlCategory);
  };

  const removeCategory = () => {
    updateSearch(searchTerm, selectedGenres, 1, "");
  };

  const removeQuery = () => {
    setSearchTerm("");
    updateSearch("", selectedGenres, 1, urlCategory);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    navigate("/search");
  };

  const handlePageChange = (newPage: number) => {
    updateSearch(urlQuery, selectedGenres, newPage, urlCategory);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full space-y-8 flex-1 flex flex-col page-enter">
      {/* Header & Search Control Area */}
      <div className="flex flex-col items-center text-center space-y-5 max-w-3xl mx-auto w-full pt-2">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-3">
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-pulse" />
            Discover & Search Anime
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground/80 max-w-xl mx-auto">
            Filter by multiple genres, search any title, or explore all-time popular &amp; top rated masterpieces.
          </p>
        </div>

        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full max-w-2xl">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search anime titles, characters, creators..."
            className="w-full h-12 bg-card/90 hover:bg-secondary/40 focus:bg-card border border-border/80 rounded-full pl-12 pr-28 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60 shadow-lg"
          />
          <Search className="absolute left-4 w-5 h-5 text-muted-foreground/70 pointer-events-none" />

          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                updateSearch("", selectedGenres);
              }}
              className="absolute right-20 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-white transition-all cursor-pointer"
              title="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <Button
            type="submit"
            size="sm"
            className="absolute right-2 h-8 rounded-full px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
          >
            Search
          </Button>
        </form>

        {/* Genre Selector Pills Box */}
        <div className="w-full bg-card/30 border border-border/40 rounded-2xl p-4 sm:p-5 backdrop-blur-sm space-y-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                Filter by Genre
              </span>
              {selectedGenres.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold border border-primary/30">
                  {selectedGenres.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-secondary/40"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGenreFilter(!showGenreFilter)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showGenreFilter ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {showGenreFilter && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 animate-fade-in">
              {POPULAR_GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre.name);
                const Icon = genre.icon;
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-sm shadow-primary/30 font-bold scale-[1.02]"
                        : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/40 hover:border-border/80"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{genre.name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Body: Filtered Results vs Default Discover Sections */}
      {hasFilters ? (
        /* Filtered Search Results Section with Pagination */
        <div className="space-y-6 flex-1 flex flex-col justify-start">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                {urlCategory && CATEGORY_CONFIG[urlCategory] ? (
                  <span>{CATEGORY_CONFIG[urlCategory].title}</span>
                ) : urlQuery ? (
                  <>
                    <span>Results for</span>
                    <span className="text-primary font-semibold">&ldquo;{urlQuery}&rdquo;</span>
                  </>
                ) : selectedGenres.length > 0 ? (
                  <span>{selectedGenres.join(" • ")} Anime</span>
                ) : (
                  <span>Browse Anime</span>
                )}
                {urlPage > 1 && (
                  <span className="text-xs font-normal text-muted-foreground bg-secondary/80 px-2.5 py-0.5 rounded-full border border-border/50">
                    Page {urlPage}
                  </span>
                )}
              </h2>

              {/* Active Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {urlCategory && CATEGORY_CONFIG[urlCategory] && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                    <span>Category: {CATEGORY_CONFIG[urlCategory].badge}</span>
                    <button
                      type="button"
                      onClick={removeCategory}
                      className="hover:text-white rounded-full p-0.5 hover:bg-primary/40 transition-colors cursor-pointer"
                      title="Clear category filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {urlQuery && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/80 text-foreground border border-border">
                    <span>Search: {urlQuery}</span>
                    <button
                      type="button"
                      onClick={removeQuery}
                      className="hover:text-white rounded-full p-0.5 hover:bg-muted transition-colors cursor-pointer"
                      title="Clear text search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedGenres.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30"
                  >
                    <span>{g}</span>
                    <button
                      type="button"
                      onClick={() => removeGenre(g)}
                      className="hover:text-white rounded-full p-0.5 hover:bg-primary/40 transition-colors cursor-pointer"
                      title={`Remove ${g} filter`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs self-start sm:self-center border-border/50 text-muted-foreground hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear All Filters
            </Button>
          </div>

          {searchError ? (
            <div className="text-center py-16 space-y-3 bg-card/20 rounded-2xl border border-destructive/20 p-6">
              <p className="font-semibold text-destructive">Failed to load anime results</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{searchError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSearch(searchTerm, selectedGenres, urlPage, urlCategory)}
                className="rounded-full mt-2 cursor-pointer"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <AnimeGrid animeList={searchResults} loading={searchLoading} />

              {/* Responsive Pagination Controls */}
              {!searchLoading && searchResults && searchResults.length > 0 && (
                <Pagination
                  currentPage={urlPage}
                  totalPages={pagination?.last_visible_page || 1}
                  hasNextPage={pagination?.has_next_page}
                  onPageChange={handlePageChange}
                />
              )}
            </>
          )}
        </div>
      ) : (
        /* Default Discover Showcase Sections with View More Links */
        <div className="space-y-12 flex-1 flex flex-col justify-start">
          {/* Section 1: Most Watched / Popular Anime */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    Most Watched &amp; Popular Anime
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    All-time community favorites and worldwide legendary series.
                  </p>
                </div>
              </div>

              <Link
                to="/search?category=popular"
                className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors group cursor-pointer"
              >
                <span>View More</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <AnimeGrid
              animeList={popularList ? popularList.slice(0, 12) : null}
              loading={popularLoading}
            />
          </section>

          {/* Section 2: Top Rated Masterpieces */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    Top Rated Anime Masterpieces
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    The highest scored series in anime history.
                  </p>
                </div>
              </div>

              <Link
                to="/search?category=top-rated"
                className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors group cursor-pointer"
              >
                <span>View More</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <AnimeGrid
              animeList={topRatedList ? topRatedList.slice(0, 12) : null}
              loading={topRatedLoading}
            />
          </section>

          {/* Section 3: Trending Airing Series */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    Currently Airing Hits
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Hot episodes released this season.
                  </p>
                </div>
              </div>

              <Link
                to="/search?category=top-airing"
                className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors group cursor-pointer"
              >
                <span>View More</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <AnimeGrid
              animeList={topAiringList ? topAiringList.slice(0, 12) : null}
              loading={topAiringLoading}
            />
          </section>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
