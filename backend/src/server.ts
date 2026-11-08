import express from "express";
import cors from "cors";
import env from "./config/env";
import animeRoutes from "./routes/anime";
import streamRoutes from "./routes/stream";
import historyRoutes from "./routes/history";
import watchlistRoutes from "./routes/watchlist";
import errorHandler from "./middleware/errorHandler";
import { jikanService } from "./services/jikanService";

const app = express();

// Configure CORS - Allow frontend origins (localhost, Vercel preview/production, and custom domains)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server, curl, mobile, or direct requests with no origin header
      if (!origin) return callback(null, true);

      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.endsWith(".vercel.app") ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
      ) {
        return callback(null, true);
      }

      // Permissive fallback so streaming resources are never blocked by CORS
      return callback(null, true);
    },
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Cache Warmup ───────────────────────────────────────────────────────────
// Pre-fetches the most visited endpoints so the first real user gets instant
// cached responses instead of waiting 2-4s for upstream APIs.
let lastWarmup = 0;
const WARMUP_INTERVAL = 12 * 60 * 1000; // 12 minutes (cache TTL is 15min)

async function warmupCache() {
  const now = Date.now();
  if (now - lastWarmup < WARMUP_INTERVAL) return; // still warm
  lastWarmup = now;

  console.log("[Warmup] Pre-fetching homepage data...");
  const endpoints = [
    jikanService.getTrending(1),
    jikanService.getTopAiring(1),
    jikanService.getUpcoming(1),
    jikanService.getPopular(1),
  ];

  try {
    await Promise.allSettled(endpoints);
    console.log("[Warmup] Cache warmed successfully.");
  } catch (err: any) {
    console.warn("[Warmup] Partial failure:", err.message);
  }
}

// Health Check (supports both GET and HEAD on /health and /api/health for cron pingers)
// Now also triggers cache warmup so the API data is always pre-loaded
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });

  // Fire warmup after flushing the 200 OK response so health checks return in <5ms
  setImmediate(() => {
    warmupCache().catch(() => {});
  });
};

app.get("/", healthHandler);
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);
app.head("/", (_req, res) => res.status(200).end());
app.head("/health", (_req, res) => res.status(200).end());
app.head("/api/health", (_req, res) => res.status(200).end());

// Register API Routes
app.use("/api/anime", animeRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/watchlist", watchlistRoutes);

// Global Error Handler
app.use(errorHandler);

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 AniVerse Backend Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`);

  // Defer cache warmup by 4s so Express answers Render's startup health probe with zero CPU contention
  setTimeout(() => {
    warmupCache().catch(() => {});
  }, 4000);
});
