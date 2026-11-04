import { Link } from "react-router-dom";
import { Film, ExternalLink, MessageSquare } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-background border-t border-border/40 text-muted-foreground transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4 col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-wider text-foreground">
                Ani<span className="text-primary">Verse</span>
              </span>
            </Link>
            <p className="text-sm max-w-sm leading-relaxed">
              Explore and watch your favorite anime. Keep track of your progress, manage your watchlist, and stream seamless high-definition video.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-foreground transition-colors"><ExternalLink className="w-4 h-4" /></a>
              <a href="#" className="hover:text-foreground transition-colors"><ExternalLink className="w-4 h-4" /></a>
              <a href="#" className="hover:text-foreground transition-colors"><MessageSquare className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Navigation</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link to="/search" className="hover:text-foreground transition-colors">Discover</Link></li>
              <li><Link to="/watchlist" className="hover:text-foreground transition-colors">Watchlist</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><p className="text-xs mt-4 max-w-xs leading-normal text-muted-foreground/60">
                AniVerse does not host videos. It resolves streams for educational purposes.
              </p></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} AniVerse. All rights reserved.</p>
          <p>Created for Anime Fans.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
