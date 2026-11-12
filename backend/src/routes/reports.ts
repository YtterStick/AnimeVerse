import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import { optionalAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import supabase from "../config/supabase";
import {
  adminMarkCommentAsSpoiler,
  adminRemoveEpisodeComment,
  getEpisodeCommentById,
} from "./comments";

const router = Router();

const BUCKET_NAME = "video-reports";
const FILE_NAME = "reports.json";
const COMMENT_REPORTS_FILE = "comment-reports.json";

export type CommentReportCategory =
  | "spoiler"
  | "bad_language"
  | "sexual"
  | "harassment"
  | "spam"
  | "other";

export type CommentReportAction = "marked_spoiler" | "deleted_comment" | "dismissed" | null;

export interface CommentReport {
  id: string;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  comment_id: string;
  comment_author: string;
  comment_content: string;
  comment_is_spoiler: boolean;
  category: CommentReportCategory;
  reason: string;
  details: string;
  reporter_email: string;
  status: "open" | "resolved";
  action_taken: CommentReportAction;
  report_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

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
let cachedCommentReports: CommentReport[] | null = null;
let bucketEnsured = false;
let commentReportWriteQueue: Promise<unknown> = Promise.resolve();

const VALID_COMMENT_CATEGORIES = new Set<CommentReportCategory>([
  "spoiler",
  "bad_language",
  "sexual",
  "harassment",
  "spam",
  "other",
]);

function enqueueCommentReportWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = commentReportWriteQueue.catch(() => undefined).then(task);
  commentReportWriteQueue = next;
  return next;
}

async function loadCommentReports(forceRefresh = false): Promise<CommentReport[]> {
  if (cachedCommentReports !== null && !forceRefresh) {
    return cachedCommentReports;
  }

  await ensureBucket();

  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(COMMENT_REPORTS_FILE);
    if (error || !data) {
      cachedCommentReports = [];
      return cachedCommentReports;
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    cachedCommentReports = Array.isArray(parsed) ? parsed : [];
    return cachedCommentReports;
  } catch {
    cachedCommentReports = [];
    return cachedCommentReports;
  }
}

async function saveCommentReports(reports: CommentReport[]): Promise<void> {
  cachedCommentReports = reports;
  await ensureBucket();

  const payload = JSON.stringify(reports, null, 2);
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(COMMENT_REPORTS_FILE, Buffer.from(payload, "utf-8"), {
      contentType: "application/json",
      cacheControl: "0",
      upsert: true,
    });

  if (error) {
    console.error("[Reports] Failed to save comment reports to Supabase Storage:", error.message);
    throw error;
  }
}

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
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(FILE_NAME, Buffer.from(payload, "utf-8"), {
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
      let prevDetails = existing.details
        ? existing.details.replace(/Verified test issue/gi, "").replace(/^\|\s*|\s*\|$/g, "").trim()
        : "";

      let combinedDetails = prevDetails;
      if (cleanDetails) {
        combinedDetails = prevDetails && !prevDetails.includes(cleanDetails)
          ? `${cleanDetails} | ${prevDetails}`.slice(0, 600)
          : cleanDetails;
      }

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
        details: cleanDetails.replace(/Verified test issue/gi, "").trim(),
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

// POST /api/reports/comments — Anyone can report a comment (spoiler, bad language, sexual, spam, etc.)
router.post("/comments", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      anime_id,
      anime_title,
      anime_image,
      episode_number,
      comment_id,
      comment_author,
      comment_content,
      category,
      reason,
      details,
    } = req.body || {};

    const parsedAnimeId = Number(anime_id);
    const parsedEpisode = Number(episode_number);
    const cleanCommentId = String(comment_id || "").trim();

    if (!parsedAnimeId || !parsedEpisode || !cleanCommentId || !reason) {
      return res.status(400).json({ message: "Missing required comment report fields" });
    }

    const rawCategory = String(category || "other").trim().toLowerCase() as CommentReportCategory;
    const safeCategory: CommentReportCategory = VALID_COMMENT_CATEGORIES.has(rawCategory)
      ? rawCategory
      : "other";

    const cleanReason = String(reason).trim().slice(0, 120);
    const cleanDetails = String(details || "").trim().slice(0, 500);
    const guestId =
      typeof req.headers["x-guest-id"] === "string" ? req.headers["x-guest-id"].trim() : "";
    const reporterEmail = req.user?.email || (guestId ? `Guest (${guestId.slice(0, 10)})` : "Guest");

    // Verify canonical comment from episode discussion storage when available
    const liveComment = await getEpisodeCommentById(parsedAnimeId, parsedEpisode, cleanCommentId).catch(
      () => null
    );

    const authoritativeAuthor = liveComment?.author_name || String(comment_author || "AnimeFan").trim().slice(0, 80);
    const authoritativeContent = (liveComment?.content || String(comment_content || "")).trim().slice(0, 1000);
    if (!authoritativeContent) {
      return res.status(404).json({ message: "Comment not found or already deleted" });
    }

    const savedReport = await enqueueCommentReportWrite(async () => {
      const reports = await loadCommentReports(true);
      const now = new Date().toISOString();

      // Merge reports against the same open comment report
      const existingIndex = reports.findIndex(
        (r) =>
          r.status === "open" &&
          r.anime_id === parsedAnimeId &&
          r.episode_number === parsedEpisode &&
          r.comment_id === cleanCommentId
      );

      let result: CommentReport;
      if (existingIndex !== -1) {
        const existing = reports[existingIndex];
        const mergedReason = existing.reason.toLowerCase().includes(cleanReason.toLowerCase())
          ? existing.reason
          : `${existing.reason}, ${cleanReason}`.slice(0, 180);

        let combinedDetails = existing.details || "";
        if (cleanDetails && !combinedDetails.includes(cleanDetails)) {
          combinedDetails = combinedDetails
            ? `${cleanDetails} | ${combinedDetails}`.slice(0, 600)
            : cleanDetails;
        }

        result = {
          ...existing,
          comment_is_spoiler: Boolean(liveComment?.is_spoiler ?? existing.comment_is_spoiler),
          reason: mergedReason,
          details: combinedDetails,
          report_count: (existing.report_count || 1) + 1,
          updated_at: now,
          reporter_email:
            existing.reporter_email.startsWith("Guest") && req.user?.email
              ? req.user.email
              : existing.reporter_email,
        };
        reports[existingIndex] = result;
      } else {
        result = {
          id: crypto.randomUUID(),
          anime_id: parsedAnimeId,
          anime_title: String(anime_title || `Anime #${parsedAnimeId}`).trim().slice(0, 200),
          anime_image: anime_image ? String(anime_image).trim() : null,
          episode_number: parsedEpisode,
          comment_id: cleanCommentId,
          comment_author: authoritativeAuthor,
          comment_content: authoritativeContent,
          comment_is_spoiler: Boolean(liveComment?.is_spoiler),
          category: safeCategory,
          reason: cleanReason,
          details: cleanDetails,
          reporter_email: reporterEmail,
          status: "open",
          action_taken: null,
          report_count: 1,
          created_at: now,
          updated_at: now,
          resolved_at: null,
        };
        reports.unshift(result);
      }

      await saveCommentReports(reports.slice(0, 500));
      return result;
    });

    res.status(201).json({ data: savedReport, message: "Comment reported for admin review" });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/comments — Admin only: list all reported comments
router.get("/comments", requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await loadCommentReports(true);
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

// PATCH /api/reports/comments/:id — Admin processes a reported comment (mark spoiler, delete comment, dismiss, or reopen)
router.patch("/comments/:id", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};

    if (
      action !== "marked_spoiler" &&
      action !== "deleted_comment" &&
      action !== "dismissed" &&
      action !== "reopen"
    ) {
      return res.status(400).json({
        message: "Action must be 'marked_spoiler', 'deleted_comment', 'dismissed', or 'reopen'",
      });
    }

    const updatedReport = await enqueueCommentReportWrite(async () => {
      const reports = await loadCommentReports(true);
      const idx = reports.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const target = reports[idx];

      if (action === "marked_spoiler") {
        await adminMarkCommentAsSpoiler(target.anime_id, target.episode_number, target.comment_id);
      } else if (action === "deleted_comment") {
        await adminRemoveEpisodeComment(target.anime_id, target.episode_number, target.comment_id);
      }

      const now = new Date().toISOString();
      const nextStatus: "open" | "resolved" = action === "reopen" ? "open" : "resolved";

      const nextRecord: CommentReport = {
        ...target,
        status: nextStatus,
        action_taken: action === "reopen" ? null : action,
        comment_is_spoiler: action === "marked_spoiler" ? true : target.comment_is_spoiler,
        updated_at: now,
        resolved_at: nextStatus === "resolved" ? now : null,
      };
      reports[idx] = nextRecord;
      await saveCommentReports(reports);
      return nextRecord;
    });

    if (!updatedReport) {
      return res.status(404).json({ message: "Comment report not found" });
    }

    res.json({ data: updatedReport });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/reports/comments/:id — Admin only: remove comment report entry (or 'resolved' to clear all resolved)
router.delete("/comments/:id", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const remaining = await enqueueCommentReportWrite(async () => {
      const reports = await loadCommentReports(true);
      const filtered =
        id === "resolved"
          ? reports.filter((r) => r.status !== "resolved")
          : reports.filter((r) => r.id !== id);
      await saveCommentReports(filtered);
      return filtered.length;
    });
    res.json({ message: "Comment report(s) deleted", remaining });
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

