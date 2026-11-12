import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Home, Compass, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page Not Found • AniVerse";
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center space-y-6 page-enter">
      <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
        <Ghost className="w-10 h-10 text-primary" />
      </div>

      <div className="space-y-2 max-w-md">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">404 • Not Found</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Lost in Another Dimension
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The page or anime link you visited doesn&apos;t exist or may have moved.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="rounded-full bg-primary hover:bg-primary/90 text-white px-6">
          <Link to="/" className="gap-2">
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-border/60 px-6">
          <Link to="/search" className="gap-2">
            <Compass className="w-4 h-4" />
            Discover Anime
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default NotFoundPage;

