import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Search, Film, Heart, LogIn, Menu, X } from "lucide-react";
import { UserMenu } from "../auth/UserMenu";
import { AuthModal } from "../auth/AuthModal";

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"signin" | "signup">("signin");

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
    }
  };

  const openAuthModal = (tab: "signin" | "signup") => {
    setAuthDefaultTab(tab);
    setIsAuthModalOpen(true);
  };

  const isActive = (path: string) => location.pathname === path;

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
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative w-9 h-9 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/30 transition-all duration-300">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-wider text-white group-hover:gradient-text transition-all duration-300">
                Ani<span className="text-primary transition-colors duration-300 group-hover:text-transparent">Verse</span>
              </span>
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

            {/* Search Input Box */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:block flex-1 max-w-sm relative">
              <input
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-secondary/80 border border-border/80 rounded-full px-4 pl-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
              />
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            </form>

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
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-secondary/80 border border-border/80 rounded-full px-4 pl-10 text-sm focus:outline-none text-foreground"
              />
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
            </form>

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
