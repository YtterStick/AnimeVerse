import { Router, Request, Response, NextFunction } from "express";
import { jikanService, GENRE_MAP } from "../services/jikanService";

const router = Router();

// GET /api/anime/genres
router.get("/genres", (_req: Request, res: Response) => {
  const genres = Object.entries(GENRE_MAP).map(([name, id]) => ({ id, name }));
  res.json({ data: genres });
});

// GET /api/anime/search
router.get("/search", async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const q = (req.query.q as string) || "";
    const page = parseInt(req.query.page as string, 10) || 1;
    const genres = (req.query.genres as string) || "";
    const data = await jikanService.searchAnime(q, page, genres);
    res.json(data);
  } catch (error: any) {
    console.warn("[AnimeRoute] Search failed:", error.message);
    res.json({
      data: [],
      pagination: {
        last_visible_page: 1,
        has_next_page: false,
        current_page: 1,
        items: { count: 0, total: 0, per_page: 25 },
      },
    });
  }
});

// GET /api/anime/top-rated
router.get("/top-rated", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const data = await jikanService.getTopRated(page);
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
