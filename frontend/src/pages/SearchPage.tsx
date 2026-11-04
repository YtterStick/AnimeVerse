import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAnimeSearch } from "@/hooks/useAnime";
import { AnimeGrid } from "@/components/anime/AnimeGrid";
import { SearchBar } from "@/components/shared/SearchBar";
import { Search } from "lucide-react";

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract 'q' query parameter from URL
  const queryParams = new URLSearchParams(location.search);
  const urlQuery = queryParams.get("q") || "";

  const [searchTerm, setSearchTerm] = useState(urlQuery);

  // Sync state with URL when it changes
  useEffect(() => {
    setSearchTerm(urlQuery);
  }, [urlQuery]);

  const { data: searchResults, loading, error } = useAnimeSearch(urlQuery);

  const handleSearch = (newQuery: string) => {
    if (newQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(newQuery.trim())}`);
    } else {
      navigate("/search");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full space-y-8 flex-1 flex flex-col page-enter">
      {/* Header & Large Search Bar Centerpiece */}
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto w-full py-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
          <Search className="w-7 h-7 text-primary" />
          Discover Anime
        </h1>
        <p className="text-sm text-muted-foreground/80 leading-normal text-balance">
          Search Jikan MyAnimeList database to find trending series, movies, and all-time favorites.
        </p>
        <SearchBar
          initialValue={searchTerm}
          onSearch={handleSearch}
          placeholder="Search title, genre, studio..."
          className="pt-2 w-full"
        />
      </div>

      {/* Grid Results Section */}
      <div className="space-y-4 flex-1 flex flex-col justify-start">
        {urlQuery && (
          <h2 className="text-lg font-semibold text-foreground border-b border-border/20 pb-2">
            Search Results for <span className="text-primary">"{urlQuery}"</span>
          </h2>
        )}

        {error ? (
          <div className="text-center py-12 text-destructive">
            <p className="font-semibold">Failed to search catalog</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        ) : (
          <AnimeGrid animeList={searchResults} loading={loading && !!urlQuery} />
        )}
      </div>
    </div>
  );
}

export default SearchPage;
