import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, Compass, Film, History, Bookmark, FileText, Shield, Heart } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { DonationModal } from "@/components/shared/DonationModal";

export function Footer() {
  const [isDonationOpen, setIsDonationOpen] = useState(false);

  return (
    <>
      <footer className="bg-background/95 border-t border-border/40 text-muted-foreground transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {/* Brand Column */}
            <div className="space-y-4">
              <Link to="/" className="flex items-center group w-fit" aria-label="AniVerse home">
                <Logo size={36} />
              </Link>
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground/90">
                Explore, stream, and track your favorite anime with fast playback, multi-server fallback, and synchronized cross-device watch history.
              </p>
            </div>

            {/* Navigation Column - with icons for all links */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <span>Navigation</span>
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <Link
                    to="/"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <Home className="w-3.5 h-3.5 text-primary" />
                    <span>Home</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <Compass className="w-3.5 h-3.5 text-primary" />
                    <span>Discover Anime</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search?category=movies"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <Film className="w-3.5 h-3.5 text-primary" />
                    <span>Anime Movies</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/history"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <History className="w-3.5 h-3.5 text-primary" />
                    <span>Watch History</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/watchlist"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-primary" />
                    <span>Watchlist</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <span>Legal &amp; Policy</span>
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span>Terms of Service</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-2"
                  >
                    <Shield className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span>Privacy Policy</span>
                  </Link>
                </li>
                <li>
                  <p className="text-[11px] mt-2 max-w-xs leading-normal text-muted-foreground/60 border-l border-border/50 pl-2">
                    AniVerse does not host video files. Streams are indexed from third-party services for educational discovery.
                  </p>
                </li>
              </ul>
            </div>

            {/* Single Unified Support Column (No redundancy) */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/30" />
                <span>Support AniVerse</span>
              </h3>
              <div className="bg-card/60 border border-border/60 rounded-xl p-3.5 space-y-2.5 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground leading-snug">
                  AniVerse is completely free and community driven. Help us cover server hosting &amp; API costs.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsDonationOpen(true)}
                  className="w-full text-xs font-bold bg-primary hover:bg-primary/90 text-white cursor-pointer h-8 rounded-lg shadow-sm"
                >
                  <Heart className="w-3.5 h-3.5 mr-1.5 text-pink-300 fill-pink-300" />
                  Support AniVerse
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="mt-10 pt-6 border-t border-border/20 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground/80">
            <p>&copy; {new Date().getFullYear()} AniVerse. All rights reserved.</p>
            <p className="flex items-center gap-1">
              <span>Crafted for Anime Fans worldwide</span>
              <span className="text-pink-400">♥</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Donation Modal Triggered from Footer */}
      <DonationModal isOpen={isDonationOpen} onClose={() => setIsDonationOpen(false)} />
    </>
  );
}

export default Footer;
