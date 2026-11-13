import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useLayout } from "@/contexts/LayoutContext";

export function Layout() {
  const { tvMode } = useLayout();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 520);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    </div>
  );
}

export default Layout;
