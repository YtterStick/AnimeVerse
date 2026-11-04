import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import supabase from "../config/supabase";

const router = Router();

// Require authentication for all watchlist routes
router.use(requireAuth);

// GET /api/watchlist - Get user's watchlist
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("watchlists")
      .select("*")
      .eq("user_id", userId)
      .order("added_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/watchlist - Add anime to watchlist
router.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { anime_id, anime_title, anime_image, anime_type } = req.body;

    if (!anime_id || !anime_title) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("watchlists")
      .upsert(
        {
          user_id: userId,
          anime_id,
          anime_title,
          anime_image,
          anime_type,
          added_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,anime_id",
        }
      )
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/watchlist/:animeId - Remove anime from watchlist
router.delete("/:animeId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const animeId = parseInt(req.params.animeId, 10);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (isNaN(animeId)) return res.status(400).json({ message: "Invalid Anime ID" });

    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("anime_id", animeId)
      .eq("user_id", userId);

    if (error) throw error;
    res.json({ message: "Anime removed from watchlist" });
  } catch (error) {
    next(error);
  }
});

// GET /api/watchlist/check/:animeId - Check if anime is in watchlist
router.get("/check/:animeId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const animeId = parseInt(req.params.animeId, 10);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (isNaN(animeId)) return res.status(400).json({ message: "Invalid Anime ID" });

    const { data, error } = await supabase
      .from("watchlists")
      .select("id")
      .eq("anime_id", animeId)
      .eq("user_id", userId);

    if (error) throw error;
    res.json({ exists: data.length > 0 });
  } catch (error) {
    next(error);
  }
});

export default router;
