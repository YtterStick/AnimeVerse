import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import { optionalAuth, isAdminUser, AuthRequest } from "../middleware/auth";
import supabase from "../config/supabase";
import { detectExplicitContent, moderateCommentContent } from "../utils/contentModeration";

const router = Router();

const BUCKET_NAME = "episode-comments";
const REACTION_TYPES = ["like", "love", "fire", "funny", "sad"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

interface StoredComment {
  id: string;
  parent_id: string | null;
  actor_key: string;
  author_name: string;
  author_avatar: string | null;
  is_guest: boolean;
  content: string;
  is_spoiler: boolean;
  liked_by: string[];
  created_at: string;
}

interface EpisodeDiscussionRecord {
  anime_id: number;
  episode_number: number;
  reactions: Record<ReactionType, string[]>;
  comments: StoredComment[];
}

export interface PublicComment {
  id: string;
  parent_id: string | null;
  author_name: string;
  author_avatar: string | null;
  is_guest: boolean;
  content: string;
  is_spoiler: boolean;
  likes_count: number;
  liked_by_me: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface PublicDiscussion {
  reactions: Record<ReactionType, number>;
  userReactions: ReactionType[];
  comments: PublicComment[];
}

interface CacheEntry {
  record: EpisodeDiscussionRecord;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 250;
const MAX_COMMENTS_PER_EPISODE = 250;
const COMMENT_COOLDOWN_MS = 3000;

const episodeCache = new Map<string, CacheEntry>();
const writeQueues = new Map<string, Promise<unknown>>();
const lastCommentByActor = new Map<string, number>();
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

function getEpisodeKey(animeId: number, episodeNumber: number): string {
  return `${animeId}-${episodeNumber}`;
}

function getFileName(animeId: number, episodeNumber: number): string {
  return `episode-${animeId}-${episodeNumber}.json`;
}

function createEmptyRecord(animeId: number, episodeNumber: number): EpisodeDiscussionRecord {
  return {
    anime_id: animeId,
    episode_number: episodeNumber,
    reactions: {
      like: [],
      love: [],
      fire: [],
      funny: [],
      sad: [],
    },
    comments: [],
  };
}

function normalizeRecord(
  raw: unknown,
  animeId: number,
  episodeNumber: number
): EpisodeDiscussionRecord {
  const base = createEmptyRecord(animeId, episodeNumber);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<EpisodeDiscussionRecord>;

  if (obj.reactions && typeof obj.reactions === "object") {
    for (const type of REACTION_TYPES) {
      const list = obj.reactions[type];
      if (Array.isArray(list)) {
        base.reactions[type] = Array.from(
          new Set(list.filter((item): item is string => typeof item === "string" && item.length > 0))
        );
      }
    }
  }

  if (Array.isArray(obj.comments)) {
    base.comments = obj.comments
      .filter((c): c is StoredComment => Boolean(c && typeof c.id === "string" && typeof c.content === "string"))
      .map((c) => ({
        id: c.id,
        parent_id: typeof c.parent_id === "string" && c.parent_id.trim() ? c.parent_id.trim() : null,
        actor_key: typeof c.actor_key === "string" ? c.actor_key : "",
        author_name: typeof c.author_name === "string" && c.author_name.trim() ? c.author_name.trim() : "AnimeFan",
        author_avatar: typeof c.author_avatar === "string" ? c.author_avatar : null,
        is_guest: Boolean(c.is_guest),
        content: c.content,
        is_spoiler: Boolean(c.is_spoiler),
        liked_by: Array.isArray(c.liked_by)
          ? Array.from(new Set(c.liked_by.filter((id): id is string => typeof id === "string")))
          : [],
        created_at: typeof c.created_at === "string" ? c.created_at : new Date().toISOString(),
      }));
  }

  return base;
}

function setCachedRecord(key: string, record: EpisodeDiscussionRecord): void {
  if (episodeCache.size >= MAX_CACHE_ENTRIES && !episodeCache.has(key)) {
    const oldestKey = episodeCache.keys().next().value;
    if (oldestKey) episodeCache.delete(oldestKey);
  }
  episodeCache.set(key, {
    record,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function loadEpisodeRecord(
  animeId: number,
  episodeNumber: number,
  forceRefresh = false
): Promise<EpisodeDiscussionRecord> {
  const key = getEpisodeKey(animeId, episodeNumber);
  const cached = episodeCache.get(key);
  if (cached && !forceRefresh && cached.expiresAt > Date.now()) {
    return cached.record;
  }

  await ensureBucket();

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(getFileName(animeId, episodeNumber));

    if (error || !data) {
      const empty = createEmptyRecord(animeId, episodeNumber);
      setCachedRecord(key, empty);
      return empty;
    }

    const text = await data.text();
    const parsed = JSON.parse(text);
    const normalized = normalizeRecord(parsed, animeId, episodeNumber);
    setCachedRecord(key, normalized);
    return normalized;
  } catch {
    const empty = createEmptyRecord(animeId, episodeNumber);
    setCachedRecord(key, empty);
    return empty;
  }
}

async function saveEpisodeRecord(record: EpisodeDiscussionRecord): Promise<void> {
  const key = getEpisodeKey(record.anime_id, record.episode_number);
  setCachedRecord(key, record);
  await ensureBucket();

  const payload = JSON.stringify(record);
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(getFileName(record.anime_id, record.episode_number), Buffer.from(payload, "utf-8"), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    console.error("[Comments] Failed to save episode discussion:", error.message);
    throw error;
  }
}

function enqueueEpisodeWrite<T>(
  animeId: number,
  episodeNumber: number,
  task: () => Promise<T>
): Promise<T> {
  const key = getEpisodeKey(animeId, episodeNumber);
  const prev = writeQueues.get(key) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  writeQueues.set(
    key,
    next.finally(() => {
      if (writeQueues.get(key) === next) {
        writeQueues.delete(key);
      }
    })
  );
  return next;
}

function parseEpisodeParams(
  animeIdRaw: string | string[] | undefined,
  episodeRaw: string | string[] | undefined
): { animeId: number; episodeNumber: number } | null {
  const animeId = Number(Array.isArray(animeIdRaw) ? animeIdRaw[0] : animeIdRaw);
  const episodeNumber = Number(Array.isArray(episodeRaw) ? episodeRaw[0] : episodeRaw);
  if (
    !Number.isInteger(animeId) ||
    animeId <= 0 ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber <= 0
  ) {
    return null;
  }
  return { animeId, episodeNumber };
}

function getGuestIdFromRequest(req: AuthRequest): string | null {
  const raw =
    (typeof req.headers["x-guest-id"] === "string" && req.headers["x-guest-id"]) ||
    (typeof req.body?.guest_id === "string" && req.body.guest_id) ||
    (typeof req.query?.guestId === "string" && req.query.guestId) ||
    "";
  const trimmed = raw.trim();
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function getActorKey(req: AuthRequest): string | null {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  const guestId = getGuestIdFromRequest(req);
  if (guestId) {
    return `guest:${guestId}`;
  }
  return null;
}

function sanitizeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 256) return null;
  // Allow built-in AniVerse local SVG avatars or safe HTTPS non-Google-OAuth URLs
  if (/^\/avatars\/[a-z0-9_-]+\.svg$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https:\/\/[^\s<>"']+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

async function resolveCommentAuthor(req: AuthRequest): Promise<{
  actorKey: string;
  authorName: string;
  authorAvatar: string | null;
  isGuest: boolean;
} | null> {
  if (req.user?.id) {
    let authorName = "";
    let authorAvatar: string | null = null;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", req.user.id)
        .single();

      if (profile?.username && typeof profile.username === "string") {
        authorName = profile.username.trim();
      }
      if (profile?.avatar_url && typeof profile.avatar_url === "string") {
        authorAvatar = sanitizeAvatarUrl(profile.avatar_url);
      }
    } catch {
      // Fall back to user metadata / client hint
    }

    if (!authorName) {
      const metaName = req.user.user_metadata?.username || req.user.user_metadata?.full_name;
      if (typeof metaName === "string" && metaName.trim()) {
        authorName = metaName.trim();
      }
    }
    if (!authorName && typeof req.body?.author_name === "string") {
      authorName = req.body.author_name.trim();
    }
    if (!authorAvatar) {
      authorAvatar = sanitizeAvatarUrl(req.body?.author_avatar);
    }

    authorName = (authorName || `AnimeWatcher${req.user.id.slice(0, 4)}`).slice(0, 32);
    if (detectExplicitContent(authorName)) {
      authorName = `AnimeWatcher${req.user.id.slice(0, 4)}`;
    }

    return {
      actorKey: `user:${req.user.id}`,
      authorName,
      authorAvatar,
      isGuest: false,
    };
  }

  const guestId = getGuestIdFromRequest(req);
  if (!guestId) return null;

  const rawName = typeof req.body?.author_name === "string" ? req.body.author_name.trim() : "";
  const authorName = (rawName || `Guest_${guestId.slice(-4)}`).slice(0, 32);

  return {
    actorKey: `guest:${guestId}`,
    authorName,
    authorAvatar: sanitizeAvatarUrl(req.body?.author_avatar),
    isGuest: true,
  };
}

function toPublicDiscussion(
  record: EpisodeDiscussionRecord,
  currentActorKey: string | null,
  isAdmin: boolean
): PublicDiscussion {
  const reactions: Record<ReactionType, number> = {
    like: record.reactions.like.length,
    love: record.reactions.love.length,
    fire: record.reactions.fire.length,
    funny: record.reactions.funny.length,
    sad: record.reactions.sad.length,
  };

  const userReactions: ReactionType[] = currentActorKey
    ? REACTION_TYPES.filter((type) => record.reactions[type].includes(currentActorKey))
    : [];

  const comments: PublicComment[] = record.comments.map((c) => ({
    id: c.id,
    parent_id: c.parent_id ?? null,
    author_name: c.author_name,
    author_avatar: c.author_avatar,
    is_guest: c.is_guest,
    content: c.content,
    is_spoiler: c.is_spoiler,
    likes_count: c.liked_by.length,
    liked_by_me: Boolean(currentActorKey && c.liked_by.includes(currentActorKey)),
    can_delete: Boolean(isAdmin || (currentActorKey && c.actor_key === currentActorKey)),
    created_at: c.created_at,
  }));

  return { reactions, userReactions, comments };
}

// GET /api/comments/:animeId/:episode — Public read of episode reactions & comments
router.get("/:animeId/:episode", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseEpisodeParams(req.params.animeId, req.params.episode);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid anime ID or episode number" });
    }

    const record = await loadEpisodeRecord(parsed.animeId, parsed.episodeNumber);
    const actorKey = getActorKey(req);
    const isAdmin = isAdminUser(req.user);

    res.json(toPublicDiscussion(record, actorKey, isAdmin));
  } catch (error) {
    next(error);
  }
});

// POST /api/comments/:animeId/:episode — Create comment with Filipino/English explicit block & spoiler detection
router.post("/:animeId/:episode", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseEpisodeParams(req.params.animeId, req.params.episode);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid anime ID or episode number" });
    }

    const author = await resolveCommentAuthor(req);
    if (!author) {
      return res.status(400).json({ message: "Missing user or guest identifier" });
    }

    if (author.isGuest && detectExplicitContent(author.authorName)) {
      return res.status(400).json({
        code: "EXPLICIT_CONTENT",
        message: "Display name contains explicit or offensive language and was blocked.",
      });
    }

    const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
    const moderation = moderateCommentContent(rawContent, Boolean(req.body?.is_spoiler));

    if (!moderation.cleanText) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }
    if (moderation.cleanText.length > 1000) {
      return res.status(400).json({ message: "Comment exceeds 1000 character limit" });
    }
    if (moderation.isExplicit) {
      return res.status(400).json({
        code: "EXPLICIT_CONTENT",
        message:
          moderation.reason ||
          "Explicit or offensive language (English/Filipino) is not allowed and was blocked.",
      });
    }

    const rawParentId =
      typeof req.body?.parent_id === "string" && req.body.parent_id.trim()
        ? req.body.parent_id.trim()
        : null;

    const nowMs = Date.now();
    const lastMs = lastCommentByActor.get(author.actorKey) || 0;
    if (nowMs - lastMs < COMMENT_COOLDOWN_MS) {
      return res.status(429).json({
        message: "Please wait a few seconds before posting another comment.",
      });
    }

    let parentNotFound = false;
    const updatedRecord = await enqueueEpisodeWrite(
      parsed.animeId,
      parsed.episodeNumber,
      async () => {
        const current = await loadEpisodeRecord(parsed.animeId, parsed.episodeNumber, true);

        let resolvedParentId: string | null = null;
        if (rawParentId) {
          const parentComment = current.comments.find((c) => c.id === rawParentId);
          if (!parentComment) {
            parentNotFound = true;
            return current;
          }
          resolvedParentId = parentComment.parent_id || parentComment.id;
        }

        const newComment: StoredComment = {
          id: crypto.randomUUID(),
          parent_id: resolvedParentId,
          actor_key: author.actorKey,
          author_name: author.authorName,
          author_avatar: author.authorAvatar,
          is_guest: author.isGuest,
          content: moderation.cleanText,
          is_spoiler: moderation.isSpoiler,
          liked_by: [],
          created_at: new Date().toISOString(),
        };

        lastCommentByActor.set(author.actorKey, nowMs);
        const nextComments = [newComment, ...current.comments].slice(0, MAX_COMMENTS_PER_EPISODE);
        const nextRecord: EpisodeDiscussionRecord = {
          ...current,
          comments: nextComments,
        };
        await saveEpisodeRecord(nextRecord);
        return nextRecord;
      }
    );

    if (parentNotFound) {
      return res.status(404).json({ message: "Parent comment no longer exists" });
    }

    const isAdmin = isAdminUser(req.user);
    res.status(201).json(toPublicDiscussion(updatedRecord, author.actorKey, isAdmin));
  } catch (error) {
    next(error);
  }
});

// POST /api/comments/:animeId/:episode/react — Toggle episode reaction
router.post("/:animeId/:episode/react", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseEpisodeParams(req.params.animeId, req.params.episode);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid anime ID or episode number" });
    }

    const actorKey = getActorKey(req);
    if (!actorKey) {
      return res.status(400).json({ message: "Missing user or guest identifier" });
    }

    const reactionType = req.body?.type as ReactionType;
    if (!REACTION_TYPES.includes(reactionType)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }

    const updatedRecord = await enqueueEpisodeWrite(
      parsed.animeId,
      parsed.episodeNumber,
      async () => {
        const current = await loadEpisodeRecord(parsed.animeId, parsed.episodeNumber, true);
        const existingList = current.reactions[reactionType] || [];
        const hasReacted = existingList.includes(actorKey);
        const nextList = hasReacted
          ? existingList.filter((id) => id !== actorKey)
          : [...existingList, actorKey];

        const nextRecord: EpisodeDiscussionRecord = {
          ...current,
          reactions: {
            ...current.reactions,
            [reactionType]: nextList,
          },
        };
        await saveEpisodeRecord(nextRecord);
        return nextRecord;
      }
    );

    const isAdmin = isAdminUser(req.user);
    res.json(toPublicDiscussion(updatedRecord, actorKey, isAdmin));
  } catch (error) {
    next(error);
  }
});

// POST /api/comments/:animeId/:episode/:commentId/like — Toggle like on a specific comment
router.post("/:animeId/:episode/:commentId/like", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseEpisodeParams(req.params.animeId, req.params.episode);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid anime ID or episode number" });
    }

    const actorKey = getActorKey(req);
    if (!actorKey) {
      return res.status(400).json({ message: "Missing user or guest identifier" });
    }

    const commentId = String(req.params.commentId || "").trim();
    if (!commentId) {
      return res.status(400).json({ message: "Missing comment ID" });
    }

    let found = false;
    const updatedRecord = await enqueueEpisodeWrite(
      parsed.animeId,
      parsed.episodeNumber,
      async () => {
        const current = await loadEpisodeRecord(parsed.animeId, parsed.episodeNumber, true);
        const nextComments = current.comments.map((c) => {
          if (c.id !== commentId) return c;
          found = true;
          const liked = c.liked_by.includes(actorKey);
          return {
            ...c,
            liked_by: liked
              ? c.liked_by.filter((id) => id !== actorKey)
              : [...c.liked_by, actorKey],
          };
        });

        if (!found) return current;
        const nextRecord: EpisodeDiscussionRecord = {
          ...current,
          comments: nextComments,
        };
        await saveEpisodeRecord(nextRecord);
        return nextRecord;
      }
    );

    if (!found) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isAdmin = isAdminUser(req.user);
    res.json(toPublicDiscussion(updatedRecord, actorKey, isAdmin));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/comments/:animeId/:episode/:commentId — Delete own comment or admin delete
router.delete("/:animeId/:episode/:commentId", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseEpisodeParams(req.params.animeId, req.params.episode);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid anime ID or episode number" });
    }

    const actorKey = getActorKey(req);
    const isAdmin = isAdminUser(req.user);
    if (!actorKey && !isAdmin) {
      return res.status(401).json({ message: "Not authorized to delete this comment" });
    }

    const commentId = String(req.params.commentId || "").trim();
    let resultStatus: "not_found" | "forbidden" | "deleted" = "not_found";

    const updatedRecord = await enqueueEpisodeWrite(
      parsed.animeId,
      parsed.episodeNumber,
      async () => {
        const current = await loadEpisodeRecord(parsed.animeId, parsed.episodeNumber, true);
        const target = current.comments.find((c) => c.id === commentId);
        if (!target) {
          resultStatus = "not_found";
          return current;
        }
        if (!isAdmin && target.actor_key !== actorKey) {
          resultStatus = "forbidden";
          return current;
        }

        resultStatus = "deleted";
        const nextRecord: EpisodeDiscussionRecord = {
          ...current,
          comments: current.comments.filter(
            (c) => c.id !== commentId && c.parent_id !== commentId
          ),
        };
        await saveEpisodeRecord(nextRecord);
        return nextRecord;
      }
    );

    if (resultStatus === "not_found") {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (resultStatus === "forbidden") {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    res.json(toPublicDiscussion(updatedRecord, actorKey, isAdmin));
  } catch (error) {
    next(error);
  }
});

export default router;

