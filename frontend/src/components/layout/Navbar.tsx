import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Search, Heart, LogIn, Menu, X, History, Star, ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { UserMenu } from "../auth/UserMenu";
import { AuthModal } from "../auth/AuthModal";
import { animeApi } from "@/lib/api";
import type { Anime } from "@/types";

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"signin" | "signup">("signin");

  // Search autocomplete / suggestions state
  const [suggestions, setSuggestions] = useState<Anime[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sync search input with URL search param if on SearchPage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q && location.pathname === "/search") {
      setSearchQuery(q);
    } else if (location.pathname !== "/search") {
      setSearchQuery("");
    }
  }, [location]);

  // Debounced search query suggestions fetcher
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    let cancelled = false;

    const timer = setTimeout(() => {
      animeApi
        .search(trimmed, 1)
        .then((res) => {
          if (!cancelled) {
            setSuggestions(res.data || []);
            setIsSearching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setIsSearching(false);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Dismiss suggestions dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop = desktopSearchRef.current?.contains(target);
      const insideMobile = mobileSearchRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setShowDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
    }
  };

  const openAuthModal = (tab: "signin" | "signup") => {
    setAuthDefaultTab(tab);
    setIsAuthModalOpen(true);
  };

  const isActive = (path: string) => location.pathname === path;

  // Render suggestion popup overlay
  const renderSuggestionsDropdown = () => {
    if (!showDropdown || searchQuery.trim().length < 2) return null;

    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
        {isSearching && suggestions.length === 0 ? (
          <div className="p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Searching anime...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No anime found for &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {suggestions.slice(0, 5).map((anime) => {
                const image =
                  anime.images?.webp?.small_image_url ||
                  anime.images?.jpg?.small_image_url ||
                  anime.images?.webp?.image_url ||
                  "/placeholder-anime.jpg";

                return (
                  <button
                    key={anime.mal_id}
                    type="button"
                    onClick={() => {
                      navigate(`/anime/${anime.mal_id}`);
                      setShowDropdown(false);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-secondary/60 text-left transition-colors cursor-pointer group"
                  >
                    <img
                      src={image}
                      alt={anime.title}
                      className="w-8 h-11 object-cover rounded shadow-sm shrink-0 bg-muted/40"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors">
                        {anime.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {anime.type && <span>{anime.type}</span>}
                        {anime.year && <span>â€¢ {anime.year}</span>}
                        {anime.score && (
                          <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {anime.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSearchSubmit}
              className="w-full py-2.5 px-3 bg-secondary/30 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View all results for &quot;{searchQuery}&quot;</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "glass-heavy border-b border-border/40 py-3 shadow-lg"
            : "bg-gradient-to-b from-black/80 to-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center group" aria-label="AniVerse home">
              <Logo size={38} />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                to="/"
                className={`transition-colors duration-200 ${
                  isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Home
              </Link>
              <Link
                to="/search"
                className={`transition-colors duration-200 ${
                  isActive("/search") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Discover
              </Link>
              <Link
                to="/history"
                className={`transition-colors duration-200 flex items-center gap-1.5 ${
                  isActive("/history") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="w-4 h-4" /> History
              </Link>
              {user && (
                <>
                  <Link
                    to="/watchlist"
                    className={`transition-colors duration-200 flex items-center gap-1.5 ${
                      isActive("/watchlist") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Heart className="w-4 h-4" /> Watchlist
                  </Link>
                </>
              )}
            </nav>

            {/* Search Input Box (Desktop) */}
            <div ref={desktopSearchRef} className="hidden sm:block flex-1 max-w-sm relative">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) setShowDropdown(true);
                  }}
                  className="w-full h-9 bg-secondary/80 border border-border/80 rounded-full px-4 pl-10 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
                />
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-primary animate-spin pointer-events-none" />
                )}
              </form>

              {renderSuggestionsDropdown()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {user ? (
                <UserMenu />
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:text-foreground"
                    onClick={() => openAuthModal("signin")}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white rounded-full px-4 shadow-md hover:shadow-primary/20 transition-all"
                    onClick={() => openAuthModal("signup")}
                  >
                    Get Started
                  </Button>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden glass-heavy border-b border-border/40 py-4 px-4 space-y-4 animate-slide-up">
            <div ref={mobileSearchRef} className="relative w-full">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) setShowDropdown(true);
                  }}
                  className="w-full h-10 bg-secondary/80 border border-border/80 rounded-full px-4 pl-10 pr-8 text-sm focus:outline-none text-foreground"
                />
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                {isSearching && (
                  <Loader2 className="absolute right-3.5 top-3 w-4 h-4 text-primary animate-spin pointer-events-none" />
                )}
              </form>

              {renderSuggestionsDropdown()}
            </div>

            <nav className="flex flex-col gap-3 font-medium">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive("/") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                Home
              </Link>
              <Link
                to="/search"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive("/search") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                Discover
              </Link>
              <Link
                to="/history"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                  isActive("/history") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <History className="w-4 h-4" /> History
              </Link>
              {user ? (
                <Link
                    to="/watchlist"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    isActive("/watchlist") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <Heart className="w-4 h-4" /> Watchlist
                </Link>
              ) : (
                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full border-border/60 hover:bg-secondary text-foreground"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openAuthModal("signin");
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-2" /> Sign In
                  </Button>
                  <Button
                    className="w-full bg-primary hover:bg-primary/95 text-white"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openAuthModal("signup");
                    }}
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Auth Modal overlay */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} defaultTab={authDefaultTab} />
    </>
  );
}

export default Navbar;
