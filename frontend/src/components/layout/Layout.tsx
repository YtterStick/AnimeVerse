import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout() {
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

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col pt-[72px]">
        <Outlet />
      </main>

      {/* Footer Section */}
      <Footer />

      {/* Floating Back-to-Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-5 left-5 sm:left-auto sm:right-6 sm:bottom-6 z-40 w-10 h-10 rounded-full bg-card/90 hover:bg-primary border border-border/70 hover:border-primary text-foreground hover:text-white shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in zoom-in-90"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default Layout;
