import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ArrowUp, ChevronUp, ChevronDown, ArrowLeft, Maximize2 } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { InstallAppBanner } from "@/components/shared/InstallAppModal";
import { useLayout } from "@/contexts/LayoutContext";

export function Layout() {
  const { tvMode } = useLayout();
  const location = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const isWatching = location.pathname.startsWith("/watch/");

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 520);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tvDockActions = [
    {
      label: "Scroll Up",
      icon: ChevronUp,
      onClick: () =>
        window.scrollBy({ top: -Math.round(window.innerHeight * 0.7), behavior: "smooth" }),
    },
    {
      label: "Scroll Down",
      icon: ChevronDown,
      onClick: () =>
        window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: "smooth" }),
    },
    {
      label: "Go Back",
      icon: ArrowLeft,
      onClick: () => window.history.back(),
    },
    {
      label: "Toggle Fullscreen",
      icon: Maximize2,
      onClick: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      },
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-all duration-300">
      {/* Navigation Header */}
      <Navbar />

      {/* Main Page Content (extra horizontal safe padding in TV Mode for overscan) */}
      <main className={`flex-1 flex flex-col ${tvMode ? "pt-[78px] px-2 sm:px-4" : "pt-[72px]"}`}>
        <Outlet />
      </main>

      {/* Footer Section (kept compact/hidden in TV Mode to avoid couch scroll clutter) */}
      {!tvMode && <Footer />}

      {/* TV Remote Cursor Dock (TV Mode only, hidden while watching so it never covers video controls) */}
      {tvMode && !isWatching && (
        <div
          aria-label="TV remote controls"
          className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2"
        >
          {tvDockActions.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              aria-label={label}
              title={label}
              className="w-12 h-12 rounded-xl bg-card/90 hover:bg-primary border border-border/70 hover:border-primary text-foreground hover:text-white shadow-xl backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      )}

      {/* Floating Back-to-Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          title="Back to top"
          className={`fixed bottom-5 left-5 sm:left-auto sm:right-6 sm:bottom-6 z-40 rounded-full bg-card/90 hover:bg-primary border border-border/70 hover:border-primary text-foreground hover:text-white shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in zoom-in-90 ${
            tvMode ? "w-12 h-12" : "w-10 h-10"
          }`}
        >
          <ArrowUp className={tvMode ? "w-5 h-5" : "w-4 h-4"} />
        </button>
      )}

      {/* Floating Install App Banner (hidden while watching or after dismiss/install) */}
      <InstallAppBanner />
    </div>
  );
}

export default Layout;
