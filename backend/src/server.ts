import dns from "dns";
import express from "express";

// Force IPv4 first for upstream proxy requests (prevents timeouts/drops on dead IPv6 addresses)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}
import cors from "cors";
import zlib from "zlib";
import env from "./config/env";
import animeRoutes from "./routes/anime";
import streamRoutes from "./routes/stream";
import historyRoutes from "./routes/history";
import watchlistRoutes from "./routes/watchlist";
import reportRoutes from "./routes/reports";
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

// Native gzip compression for JSON responses >1KB (cuts Render container egress by ~85%)
app.use((req, res, next) => {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  if (!acceptEncoding.includes("gzip") || req.method === "HEAD") {
    return next();
  }
  const origJson = res.json.bind(res);
  res.json = (body: any): express.Response => {
    const payload = JSON.stringify(body);
    if (!payload || payload.length < 1024 || res.headersSent) {
      return origJson(body);
    }
    const compressed = zlib.gzipSync(Buffer.from(payload, "utf-8"));
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Encoding", "gzip");
    res.append("Vary", "Accept-Encoding");
    res.setHeader("Content-Length", String(compressed.length));
    return res.send(compressed);
  };
  next();
});

// ─── Startup Cache Warmup ───────────────────────────────────────────────────
// Runs once on boot so the first visitor gets instant cached responses without
// polling upstream APIs every 10 minutes when idle (saves Service-Initiated bandwidth).
let warmedOnBoot = false;

async function warmupCache() {
  if (warmedOnBoot) return;
  warmedOnBoot = true;

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

// Ultra-lightweight Health Check (11-byte body, zero upstream network calls)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({ ok: true });
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
app.use("/api/reports", reportRoutes);

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
