import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import { optionalAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import supabase from "../config/supabase";

const router = Router();

const BUCKET_NAME = "video-reports";
const FILE_NAME = "reports.json";

export interface VideoReport {
  id: string;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  server_name: string;
  category: string;
  reason: string;
  details: string;
  reporter_email: string;
  status: "open" | "resolved";
  report_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

let cachedReports: VideoReport[] | null = null;
let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  try {
    await supabase.storage.createBucket(BUCKET_NAME, { public: false });
  } catch {
    // Ignore if bucket already exists
  }
  bucketEnsured = true;
}

async function loadReports(forceRefresh = false): Promise<VideoReport[]> {
  if (cachedReports !== null && !forceRefresh) {
    return cachedReports;
  }

  await ensureBucket();

  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(FILE_NAME);
    if (error || !data) {
      cachedReports = [];
      return cachedReports;
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    cachedReports = Array.isArray(parsed) ? parsed : [];
    return cachedReports;
  } catch {
    cachedReports = [];
    return cachedReports;
  }
}

async function saveReports(reports: VideoReport[]): Promise<void> {
  cachedReports = reports;
  await ensureBucket();

  const payload = JSON.stringify(reports, null, 2);
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(FILE_NAME, payload, {
    contentType: "application/json",
    upsert: true,
  });

  if (error) {
    console.error("[Reports] Failed to save reports to Supabase Storage:", error.message);
    throw error;
  }
}

// POST /api/reports — Anyone (logged in or guest) can report a broken video stream
router.post("/", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      anime_id,
      anime_title,
      anime_image,
      episode_number,
      server_name,
      category,
      reason,
      details,
    } = req.body || {};

    const parsedAnimeId = Number(anime_id);
    const parsedEpisode = Number(episode_number);

    if (!parsedAnimeId || !anime_title || !parsedEpisode || !reason) {
      return res.status(400).json({ message: "Missing required report fields" });
    }

    const cleanReason = String(reason).trim().slice(0, 120);
    const cleanDetails = String(details || "").trim().slice(0, 500);
    const cleanServer = String(server_name || "Unknown Server").trim().slice(0, 60);
    const cleanCategory = String(category || "SUB").toUpperCase() === "DUB" ? "DUB" : "SUB";
    const reporterEmail = req.user?.email || "Guest";
    const now = new Date().toISOString();

    const reports = await loadReports(true);

    // Check if there is already an open report for the exact same anime + episode + server + reason
    const existingIndex = reports.findIndex(
      (r) =>
        r.status === "open" &&
        r.anime_id === parsedAnimeId &&
        r.episode_number === parsedEpisode &&
        r.server_name.toLowerCase() === cleanServer.toLowerCase() &&
        r.reason.toLowerCase() === cleanReason.toLowerCase()
    );

    let savedReport: VideoReport;

    if (existingIndex !== -1) {
      const existing = reports[existingIndex];
      const combinedDetails =
        cleanDetails && !existing.details.includes(cleanDetails)
          ? existing.details
            ? `${existing.details} | ${cleanDetails}`.slice(0, 600)
            : cleanDetails
          : existing.details;

      savedReport = {
        ...existing,
        report_count: (existing.report_count || 1) + 1,
        details: combinedDetails,
        updated_at: now,
        reporter_email:
          existing.reporter_email === "Guest" && reporterEmail !== "Guest"
            ? reporterEmail
            : existing.reporter_email,
      };
      reports[existingIndex] = savedReport;
    } else {
      savedReport = {
        id: crypto.randomUUID(),
        anime_id: parsedAnimeId,
        anime_title: String(anime_title).trim().slice(0, 200),
        anime_image: anime_image ? String(anime_image).trim() : null,
        episode_number: parsedEpisode,
        server_name: cleanServer,
        category: cleanCategory,
        reason: cleanReason,
        details: cleanDetails,
        reporter_email: reporterEmail,
        status: "open",
        report_count: 1,
        created_at: now,
        updated_at: now,
        resolved_at: null,
      };
      reports.unshift(savedReport);
    }

    // Keep maximum 500 reports to prevent unbounded file growth
    const trimmed = reports.slice(0, 500);
    await saveReports(trimmed);

    res.status(201).json({ data: savedReport, message: "Report submitted successfully" });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports — Admin only: list all reported videos
router.get("/", requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await loadReports(true);
    const sorted = [...reports].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

    res.json({ data: sorted });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reports/:id — Admin only: mark report as resolved or reopen it
router.patch("/:id", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (status !== "open" && status !== "resolved") {
      return res.status(400).json({ message: "Status must be 'open' or 'resolved'" });
    }

    const reports = await loadReports(true);
    const idx = reports.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: "Report not found" });
    }

    const now = new Date().toISOString();
    reports[idx] = {
      ...reports[idx],
      status,
      updated_at: now,
      resolved_at: status === "resolved" ? now : null,
    };

    await saveReports(reports);
    res.json({ data: reports[idx] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/reports/:id — Admin only: delete a report (or 'resolved' to clear all resolved)
router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reports = await loadReports(true);

    let filtered: VideoReport[];
    if (id === "resolved") {
      filtered = reports.filter((r) => r.status !== "resolved");
    } else {
      filtered = reports.filter((r) => r.id !== id);
    }

    await saveReports(filtered);
    res.json({ message: "Report(s) deleted", remaining: filtered.length });
  } catch (error) {
    next(error);
  }
});

export default router;

