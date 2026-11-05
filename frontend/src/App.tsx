import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { Layout } from "@/components/layout/Layout";
import { HomePage } from "@/pages/HomePage";

// ─── Lazy-loaded routes ──────────────────────────────────────────────────────
// These pages (especially WatchPage with the heavy Vidstack player) are only
// loaded when the user navigates to them, cutting the initial homepage bundle
// from ~1,055 kB down to ~250 kB.
const AnimePage = lazy(() => import("@/pages/AnimePage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const WatchPage = lazy(() => import("@/pages/WatchPage"));
const WatchlistPage = lazy(() => import("@/pages/WatchlistPage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallbackPage"));

// Minimal loading fallback – matches the dark theme
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="anime/:id" element={<Suspense fallback={<PageLoader />}><AnimePage /></Suspense>} />
          <Route path="search" element={<Suspense fallback={<PageLoader />}><SearchPage /></Suspense>} />
          <Route path="watch/:id/:episode" element={<Suspense fallback={<PageLoader />}><WatchPage /></Suspense>} />
          <Route path="watchlist" element={<Suspense fallback={<PageLoader />}><WatchlistPage /></Suspense>} />
          <Route path="history" element={<Suspense fallback={<PageLoader />}><HistoryPage /></Suspense>} />
          <Route path="terms" element={<Suspense fallback={<PageLoader />}><TermsPage /></Suspense>} />
          <Route path="privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
          <Route path="auth/callback" element={<Suspense fallback={<PageLoader />}><AuthCallbackPage /></Suspense>} />
        </Route>
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;
