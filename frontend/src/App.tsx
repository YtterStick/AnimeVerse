import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HomePage } from "@/pages/HomePage";
import { AnimePage } from "@/pages/AnimePage";
import { SearchPage } from "@/pages/SearchPage";
import { WatchPage } from "@/pages/WatchPage";
import { WatchlistPage } from "@/pages/WatchlistPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="anime/:id" element={<AnimePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="watch/:id/:episode" element={<WatchPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="auth/callback" element={<AuthCallbackPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
