import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Shield, FileText, Sparkles, Coffee, History } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { DonationModal } from "@/components/shared/DonationModal";

export function Footer() {
  const [isDonationOpen, setIsDonationOpen] = useState(false);

  return (
    <>
      <footer className="bg-background/95 border-t border-border/40 text-muted-foreground transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
            {/* Brand Column (2 cols on large screens) */}
            <div className="space-y-4 lg:col-span-2">
              <Link to="/" className="flex items-center group w-fit" aria-label="AniVerse home">
                <Logo size={36} />
              </Link>
              <p className="text-xs sm:text-sm max-w-sm leading-relaxed text-muted-foreground/90">
                Explore, stream, and track your favorite anime with lightning-fast playback, multi-server fallback, and synchronized cross-device watch history.
              </p>

              {/* Support pill button */}
              <div className="pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsDonationOpen(true)}
                  className="rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-primary/20 hover:from-pink-500/30 hover:to-primary/30 text-white border border-pink-500/30 text-xs font-bold px-4 py-2 shadow-sm hover:shadow-pink-500/10 transition-all cursor-pointer group"
                >
                  <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400 mr-2 group-hover:scale-110 transition-transform" />
                  <span>Support AniVerse</span>
                  <Sparkles className="w-3 h-3 text-amber-300 ml-1.5" />
                </Button>
              </div>
            </div>

            {/* Navigation Column */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <span>Navigation</span>
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <Link to="/" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-block">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/search" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-block">
                    Discover Anime
                  </Link>
                </li>
                <li>
                  <Link to="/search?category=upcoming" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upcoming Releases</span>
                  </Link>
                </li>
                <li>
                  <Link to="/history" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-primary" />
                    <span>Watch History</span>
                  </Link>
                </li>
                <li>
                  <Link to="/watchlist" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-block">
                    Watchlist
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
                  <Link to="/terms" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span>Terms of Service</span>
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-foreground transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5">
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

            {/* Donation / Support Column */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Support the Dev</span>
              </h3>
              <div className="bg-card/60 border border-border/60 rounded-xl p-3.5 space-y-2.5 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground leading-snug">
                  AniVerse is completely free and community driven. Help us cover server hosting &amp; API costs.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDonationOpen(true)}
                  className="w-full text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 hover:text-white cursor-pointer h-8 rounded-lg"
                >
                  <Heart className="w-3.5 h-3.5 mr-1.5 text-pink-400 fill-pink-400/40" />
                  MariBank QR
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
