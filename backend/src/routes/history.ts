import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import supabase from "../config/supabase";

const router = Router();

// Require authentication for all history routes
router.use(requireAuth);

// GET /api/history - Retrieve user's watch history
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .order("watched_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/history - Upsert a watch history entry
router.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      anime_id,
      anime_title,
      anime_image,
      episode_number,
      episode_title,
      progress_seconds,
      duration_seconds,
    } = req.body;

    if (!anime_id || !anime_title || isNaN(episode_number)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("watch_history")
      .upsert(
        {
          user_id: userId,
          anime_id,
          anime_title,
          anime_image,
          episode_number,
          episode_title: episode_title || `Episode ${episode_number}`,
          progress_seconds: progress_seconds || 0,
          duration_seconds: duration_seconds || 0,
          watched_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,anime_id,episode_number",
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

// DELETE /api/history/:id - Delete a specific watch history entry
router.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { error } = await supabase
      .from("watch_history")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    res.json({ message: "History entry deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
