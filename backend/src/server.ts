import express from "express";
import cors from "cors";
import env from "./config/env";
import animeRoutes from "./routes/anime";
import streamRoutes from "./routes/stream";
import historyRoutes from "./routes/history";
import watchlistRoutes from "./routes/watchlist";
import errorHandler from "./middleware/errorHandler";

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

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

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
});
