import { Router, Request, Response, NextFunction } from "express";
import { jikanService } from "../services/jikanService";

const router = Router();

// GET /api/anime/search
router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string || "";
    const page = parseInt(req.query.page as string, 10) || 1;
    const data = await jikanService.searchAnime(q, page);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/trending
router.get("/trending", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const data = await jikanService.getTrending(page);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/top-airing
router.get("/top-airing", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const data = await jikanService.getTopAiring(page);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/popular
router.get("/popular", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const data = await jikanService.getPopular(page);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid Anime ID" });
    }
    const data = await jikanService.getAnimeDetails(id);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/:id/episodes
router.get("/:id/episodes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const page = parseInt(req.query.page as string, 10) || 1;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid Anime ID" });
    }
    const data = await jikanService.getAnimeEpisodes(id, page);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/:id/recommendations
router.get("/:id/recommendations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid Anime ID" });
    }
    const data = await jikanService.getAnimeRecommendations(id);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
