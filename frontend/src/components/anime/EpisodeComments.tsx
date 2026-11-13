import { useState, useEffect, useMemo, useRef } from "react";
import {
  MessageSquare,
  Send,
  AlertTriangle,
  Eye,
  EyeOff,
  ThumbsUp,
  Trash2,
  ShieldAlert,
  Loader2,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  X,
  Flag,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/AuthModal";
import { AnimeReactionIcon } from "@/components/anime/AnimeReactionIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { commentsApi, getOrCreateGuestId, reportsApi } from "@/lib/api";
import { generateRandomAnimeProfile } from "@/lib/avatars";
import { detectSpoilerContent, moderateCommentContent } from "@/lib/contentModeration";
import type {
  CommentReportCategory,
  EpisodeComment,
  EpisodeDiscussion,
  ReactionType,
} from "@/types";

interface EpisodeCommentsProps {
  animeId: number;
  episodeNumber: number;
  animeTitle?: string;
  animeImage?: string | null;
}

const COMMENT_REPORT_OPTIONS: Array<{
  category: CommentReportCategory;
  label: string;
  description: string;
}> = [
  {
    category: "spoiler",
    label: "Unmarked Spoiler",
    description: "Reveals plot twists or future events without warning",
  },
  {
    category: "bad_language",
    label: "Bad / Offensive Language",
    description: "Profanity, insults, or disrespectful language",
  },
  {
    category: "sexual",
    label: "Sexual / NSFW Content",
    description: "Sexually explicit, lewd, or inappropriate remarks",
  },
  {
    category: "harassment",
    label: "Harassment / Hate Speech",
    description: "Targeted bullying, threats, or discrimination",
  },
  {
    category: "spam",
    label: "Spam / Scam / Links",
    description: "Ads, bot spam, or suspicious external links",
  },
  {
    category: "other",
    label: "Other Violation",
    description: "Breaks general community guidelines",
  },
];

const REACTION_OPTIONS: Array<{
  type: ReactionType;
  label: string;
  activeClass: string;
}> = [
  {
    type: "like",
    label: "Sugoi!",
    activeClass: "bg-amber-500/20 border-amber-400/70 text-amber-200 shadow-lg shadow-amber-500/20",
  },
  {
    type: "love",
    label: "Kawaii",
    activeClass: "bg-pink-500/20 border-pink-400/70 text-pink-200 shadow-lg shadow-pink-500/20",
  },
  {
    type: "fire",
    label: "Hype!",
    activeClass: "bg-orange-500/20 border-orange-400/70 text-orange-200 shadow-lg shadow-orange-500/20",
  },
  {
    type: "funny",
    label: "Kusa!",
    activeClass: "bg-teal-500/20 border-teal-400/70 text-teal-200 shadow-lg shadow-teal-500/20",
  },
  {
    type: "sad",
    label: "Feels",
    activeClass: "bg-sky-500/20 border-sky-400/70 text-sky-200 shadow-lg shadow-sky-500/20",
  },
];

const EMPTY_DISCUSSION: EpisodeDiscussion = {
  reactions: { like: 0, love: 0, fire: 0, funny: 0, sad: 0 },
  userReactions: [],
  comments: [],
};

function formatRelativeTime(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function EpisodeComments({
  animeId,
  episodeNumber,
  animeTitle,
  animeImage,
}: EpisodeCommentsProps) {
  const { user, session, displayName, avatarUrl } = useAuth();
  const toast = useToast();
  const [discussion, setDiscussion] = useState<EpisodeDiscussion>(EMPTY_DISCUSSION);
  const [loading, setLoading] = useState(true);

  // Main composer state
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reply composer state
  const [replyTarget, setReplyTarget] = useState<{
    rootCommentId: string;
    replyToName: string;
  } | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // UI toggles & non-blocking optimistic queues
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(() => new Set());
  const [burstReaction, setBurstReaction] = useState<{ type: ReactionType; key: number } | null>(null);
  const reactionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reactionSeqRef = useRef(0);
  const likeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const likeSeqRef = useRef<Map<string, number>>(new Map());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    isReply: boolean;
    replyCount: number;
  } | null>(null);
  const [reportTarget, setReportTarget] = useState<EpisodeComment | null>(null);
  const [reportCategory, setReportCategory] = useState<CommentReportCategory>("spoiler");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!deleteConfirm && !reportTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteConfirm && !pendingDeleteId) setDeleteConfirm(null);
        if (reportTarget && !submittingReport) setReportTarget(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirm, pendingDeleteId, reportTarget, submittingReport]);

  const guestProfile = useMemo(
    () => generateRandomAnimeProfile(getOrCreateGuestId()),
    []
  );

  const activeName = user ? displayName || guestProfile.username : guestProfile.username;
  const activeAvatar = user ? avatarUrl || guestProfile.avatarUrl : guestProfile.avatarUrl;
  const token = session?.access_token ?? null;

  const draftModeration = useMemo(
    () => moderateCommentContent(draft, false),
    [draft]
  );
  const autoDetectedSpoiler = useMemo(
    () => draft.trim().length > 0 && detectSpoilerContent(draft),
    [draft]
  );

  const replyModeration = useMemo(
    () => moderateCommentContent(replyDraft, false),
    [replyDraft]
  );
  const autoDetectedReplySpoiler = useMemo(
    () => replyDraft.trim().length > 0 && detectSpoilerContent(replyDraft),
    [replyDraft]
  );

  // Group top-level comments (newest first) and replies (oldest first inside thread)
  const { topLevelComments, repliesByParentId } = useMemo(() => {
    const tops: EpisodeComment[] = [];
    const repliesMap = new Map<string, EpisodeComment[]>();

    for (const c of discussion.comments) {
      if (!c.parent_id) {
        tops.push(c);
      } else {
        const list = repliesMap.get(c.parent_id) || [];
        list.push(c);
        repliesMap.set(c.parent_id, list);
      }
    }

    // Reverse each thread's replies so replies read chronologically top-to-bottom
    for (const [parentId, list] of repliesMap.entries()) {
      repliesMap.set(
        parentId,
        [...list].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );
    }

    return { topLevelComments: tops, repliesByParentId: repliesMap };
  }, [discussion.comments]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage(null);
    setReplyTarget(null);
    setReplyDraft("");
    setReplyError(null);
    setDeleteConfirm(null);
    setReportTarget(null);
    setReportDetails("");
    setReportError(null);
    setRevealedIds(new Set());
    setExpandedThreads(new Set());

    commentsApi
      .getEpisodeDiscussion(animeId, episodeNumber, token)
      .then((data) => {
        if (active) setDiscussion(data);
      })
      .catch(() => {
        if (active) setDiscussion(EMPTY_DISCUSSION);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      reactionSeqRef.current += 1;
      likeSeqRef.current.clear();
    };
  }, [animeId, episodeNumber, token]);

  const handleToggleReaction = (type: ReactionType) => {
    const seq = ++reactionSeqRef.current;

    setDiscussion((prev) => {
      const alreadyActive = prev.userReactions.includes(type);
      if (!alreadyActive) {
        setBurstReaction({ type, key: Date.now() });
      }
      return {
        ...prev,
        reactions: {
          ...prev.reactions,
          [type]: Math.max(0, (prev.reactions[type] || 0) + (alreadyActive ? -1 : 1)),
        },
        userReactions: alreadyActive
          ? prev.userReactions.filter((r) => r !== type)
          : [...prev.userReactions, type],
      };
    });

    reactionQueueRef.current = reactionQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const updated = await commentsApi.toggleVideoReaction(
            animeId,
            episodeNumber,
            type,
            token
          );
          if (reactionSeqRef.current === seq) {
            setDiscussion((curr) => ({
              ...curr,
              reactions: updated.reactions,
              userReactions: updated.userReactions,
            }));
          }
        } catch {
          if (reactionSeqRef.current === seq) {
            toast.error("Failed to update reaction. Please try again.");
          }
        }
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!draftModeration.cleanText) {
      setErrorMessage("Please write a comment before posting.");
      return;
    }

    if (draftModeration.isExplicit) {
      setErrorMessage(
        draftModeration.reason ||
          "Explicit or offensive language (English/Filipino) is automatically blocked."
      );
      return;
    }

    setSubmitting(true);
    try {
      const updated = await commentsApi.postComment(
        animeId,
        episodeNumber,
        {
          content: draftModeration.cleanText,
          is_spoiler: draftModeration.isSpoiler,
          author_name: activeName,
          author_avatar: activeAvatar,
        },
        token
      );
      setDiscussion(updated);
      setDraft("");
      toast.success("Comment posted");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to post comment right now. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReply = (comment: EpisodeComment) => {
    const rootId = comment.parent_id || comment.id;
    const isSame =
      replyTarget?.rootCommentId === rootId &&
      replyTarget?.replyToName === comment.author_name;
    if (isSame) {
      setReplyTarget(null);
      return;
    }
    setReplyTarget({ rootCommentId: rootId, replyToName: comment.author_name });
    setReplyDraft(comment.parent_id ? `@${comment.author_name} ` : "");
    setReplyError(null);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget) return;
    setReplyError(null);

    if (!replyModeration.cleanText) {
      setReplyError("Please write a reply before posting.");
      return;
    }

    if (replyModeration.isExplicit) {
      setReplyError(
        replyModeration.reason ||
          "Explicit or offensive language (English/Filipino) is automatically blocked."
      );
      return;
    }

    const targetRootId = replyTarget.rootCommentId;
    setSubmittingReply(true);
    try {
      const updated = await commentsApi.postComment(
        animeId,
        episodeNumber,
        {
          content: replyModeration.cleanText,
          is_spoiler: replyModeration.isSpoiler,
          parent_id: targetRootId,
          author_name: activeName,
          author_avatar: activeAvatar,
        },
        token
      );
      setDiscussion(updated);
      setExpandedThreads((prev) => new Set(prev).add(targetRootId));
      setReplyTarget(null);
      setReplyDraft("");
      toast.success("Reply posted");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to post reply right now. Please try again.";
      setReplyError(msg);
      toast.error(msg);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleToggleCommentLike = (commentId: string) => {
    const nextSeq = (likeSeqRef.current.get(commentId) || 0) + 1;
    likeSeqRef.current.set(commentId, nextSeq);

    setDiscussion((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              liked_by_me: !c.liked_by_me,
              likes_count: Math.max(0, c.likes_count + (c.liked_by_me ? -1 : 1)),
            }
          : c
      ),
    }));

    likeQueueRef.current = likeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const updated = await commentsApi.toggleCommentLike(
            animeId,
            episodeNumber,
            commentId,
            token
          );
          if (likeSeqRef.current.get(commentId) === nextSeq) {
            setDiscussion((curr) => ({
              ...curr,
              comments: updated.comments,
            }));
          }
        } catch {
          if (likeSeqRef.current.get(commentId) === nextSeq) {
            toast.error("Failed to update comment like");
          }
        }
      });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (pendingDeleteId === commentId) return;
    setPendingDeleteId(commentId);
    setErrorMessage(null);
    try {
      const updated = await commentsApi.deleteComment(
        animeId,
        episodeNumber,
        commentId,
        token
      );
      setDiscussion(updated);
      setDeleteConfirm(null);
      toast.info("Comment deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete comment.";
      if (/comment not found/i.test(msg)) {
        // Comment is already absent on server — resync discussion state cleanly
        try {
          const fresh = await commentsApi.getEpisodeDiscussion(
            animeId,
            episodeNumber,
            token
          );
          setDiscussion(fresh);
        } catch {
          setDiscussion((prev) => ({
            ...prev,
            comments: prev.comments.filter(
              (c) => c.id !== commentId && c.parent_id !== commentId
            ),
          }));
        }
        setDeleteConfirm(null);
        toast.info("Comment removed");
        return;
      }
      setErrorMessage(msg);
      toast.error(msg);
      setDeleteConfirm(null);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const toggleRevealSpoiler = (commentId: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const toggleExpandThread = (parentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const handleOpenReport = (comment: EpisodeComment) => {
    setReportTarget(comment);
    setReportCategory("spoiler");
    setReportDetails("");
    setReportError(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || submittingReport) return;

    const chosen =
      COMMENT_REPORT_OPTIONS.find((opt) => opt.category === reportCategory) ||
      COMMENT_REPORT_OPTIONS[0];

    setSubmittingReport(true);
    setReportError(null);
    try {
      await reportsApi.submitCommentReport(
        {
          anime_id: animeId,
          anime_title: animeTitle || `Anime #${animeId}`,
          anime_image: animeImage ?? null,
          episode_number: episodeNumber,
          comment_id: reportTarget.id,
          comment_author: reportTarget.author_name,
          comment_content: reportTarget.content,
          category: chosen.category,
          reason: chosen.label,
          details: reportDetails.trim(),
        },
        token
      );

      setReportedIds((prev) => {
        const next = new Set(prev);
        next.add(reportTarget.id);
        return next;
      });
      setReportTarget(null);
      setReportDetails("");
      toast.success("Comment reported. Admin will review it shortly.");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to submit report. Please try again.";
      setReportError(msg);
      toast.error(msg);
    } finally {
      setSubmittingReport(false);
    }
  };

  const renderCommentCard = (comment: EpisodeComment, isReply = false) => {
    const isRevealed = revealedIds.has(comment.id);
    const showMasked = comment.is_spoiler && !isRevealed;
    const replyCount = isReply ? 0 : (repliesByParentId.get(comment.id)?.length ?? 0);

    return (
      <div className="flex items-start gap-3">
        <Avatar
          className={`${isReply ? "w-7 h-7" : "w-9 h-9"} border border-border/60 shrink-0 mt-0.5`}
        >
          {comment.author_avatar ? (
            <AvatarImage
              src={comment.author_avatar}
              alt={comment.author_name}
              className="object-cover"
            />
          ) : null}
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
            {comment.author_name[0]?.toUpperCase() || "A"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${isReply ? "text-xs" : "text-sm"} font-semibold text-white`}>
              {comment.author_name}
            </span>
            {comment.is_guest && (
              <span className="px-1.5 py-0.5 rounded bg-secondary/80 text-[10px] font-medium text-muted-foreground">
                Guest
              </span>
            )}
            {comment.is_spoiler && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                <AlertTriangle className="w-3 h-3" />
                Spoiler
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>

          {showMasked ? (
            <div className="relative rounded-xl bg-black/40 border border-amber-500/25 p-3 overflow-hidden">
              <p
                aria-hidden="true"
                className="text-sm text-gray-300 whitespace-pre-wrap break-words blur-md select-none opacity-35 pointer-events-none line-clamp-2"
              >
                {comment.content}
              </p>
              <div className="inset-0 absolute flex flex-wrap items-center justify-between gap-2 px-3.5 bg-gradient-to-r from-background/80 via-background/70 to-background/80 backdrop-blur-[2px]">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                  Hidden Spoiler Warning
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleRevealSpoiler(comment.id)}
                  className="h-7 px-2.5 text-xs font-semibold gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Show Spoiler
                </Button>
              </div>
            </div>
          ) : (
            <p className={`${isReply ? "text-xs sm:text-sm" : "text-sm"} text-gray-200 whitespace-pre-wrap break-words leading-relaxed`}>
              {comment.content}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => handleToggleCommentLike(comment.id)}
              aria-pressed={comment.liked_by_me}
              className={`inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md whitespace-nowrap transition-colors ${
                comment.liked_by_me
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-white hover:bg-secondary/70"
              }`}
            >
              <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{comment.likes_count > 0 ? comment.likes_count : "Like"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenReply(comment)}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-muted-foreground hover:text-white hover:bg-secondary/70 whitespace-nowrap transition-colors"
            >
              <CornerDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Reply</span>
            </button>

            {comment.can_delete && (
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm({
                    id: comment.id,
                    isReply,
                    replyCount,
                  })
                }
                disabled={pendingDeleteId === comment.id}
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 whitespace-nowrap transition-colors"
              >
                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenReport(comment)}
              disabled={reportedIds.has(comment.id)}
              title={reportedIds.has(comment.id) ? "Reported to admin" : "Report this comment"}
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md whitespace-nowrap transition-colors ${
                reportedIds.has(comment.id)
                  ? "text-amber-300/80 bg-amber-500/10 cursor-default"
                  : "text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{reportedIds.has(comment.id) ? "Reported" : "Report"}</span>
            </button>

            {comment.is_spoiler && isRevealed && (
              <button
                type="button"
                onClick={() => toggleRevealSpoiler(comment.id)}
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-amber-300/80 hover:text-amber-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md hover:bg-amber-500/10 whitespace-nowrap transition-colors"
              >
                <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Hide Spoiler
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalReactions = REACTION_OPTIONS.reduce(
    (sum, item) => sum + (discussion.reactions[item.type] || 0),
    0
  );

  return (
    <section
      className="mt-4 sm:mt-6 rounded-2xl bg-card/40 border border-border/50 p-3.5 sm:p-6 space-y-5 sm:space-y-6"
      aria-label="Episode reactions and comments"
    >
      {/* Compact Discord-Style Animated Reactions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/35">
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Reactions
          </h2>
          {totalReactions > 0 && (
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              · {totalReactions}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {REACTION_OPTIONS.map(({ type, label, activeClass }) => {
            const count = discussion.reactions[type] || 0;
            const active = discussion.userReactions.includes(type);
            const showBurst = burstReaction?.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleToggleReaction(type)}
                aria-pressed={active}
                aria-label={`${label}${count > 0 ? ` (${count})` : ""}`}
                className={`relative group inline-flex items-center gap-2 h-10 px-2 rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer select-none ${
                  active
                    ? activeClass
                    : "bg-secondary/35 border-border/40 text-muted-foreground hover:text-white hover:border-border/80 hover:bg-secondary/65"
                }`}
              >
                {/* Hover tooltip label */}
                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-popover/95 border border-border/70 text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shadow-md z-20">
                  {label}
                </span>

                {showBurst && (
                  <span
                    key={burstReaction.key}
                    className="pointer-events-none z-30 absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs font-extrabold text-white drop-shadow anime-rx-burst"
                  >
                    +1
                  </span>
                )}

                <AnimeReactionIcon
                  type={type}
                  active={active}
                  className="w-7 h-7 sm:w-8 sm:h-8"
                />

                {count > 0 && (
                  <span
                    className={`pr-1 text-xs font-bold tabular-nums leading-none ${
                      active ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comments Header & Main Composer */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 whitespace-nowrap">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" />
            Comments ({discussion.comments.length})
          </h3>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">
            Profanity auto-blocked • Spoilers hidden
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
            <div className="flex items-center justify-between gap-2 sm:hidden">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="w-7 h-7 border border-primary/30 shrink-0">
                  {activeAvatar ? (
                    <AvatarImage src={activeAvatar} alt={activeName} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-bold">
                    {activeName[0]?.toUpperCase() || "A"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-white truncate">{activeName}</span>
                {!user && (
                  <span className="px-1.5 py-0.5 rounded bg-secondary/70 text-[10px] text-muted-foreground">
                    Guest
                  </span>
                )}
              </div>
              {!user && (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="text-[11px] text-primary hover:underline font-medium shrink-0"
                >
                  Sign in
                </button>
              )}
            </div>

            <Avatar className="hidden sm:flex w-9 h-9 border border-primary/30 shrink-0 mt-0.5">
              {activeAvatar ? (
                <AvatarImage src={activeAvatar} alt={activeName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {activeName[0]?.toUpperCase() || "A"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="hidden sm:flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-white">{activeName}</span>
                  {!user && (
                    <span className="px-1.5 py-0.5 rounded bg-secondary/70 text-[10px] text-muted-foreground">
                      Guest
                    </span>
                  )}
                </div>
                {!user && (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Sign in to sync profile
                  </button>
                )}
              </div>

              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                maxLength={1000}
                rows={2}
                placeholder="Join the discussion about this episode... (Spoilers will be hidden)"
                className={`w-full rounded-xl bg-secondary/50 border px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none transition-colors resize-y min-h-[70px] sm:min-h-[82px] ${
                  draftModeration.isExplicit
                    ? "border-red-500/70 focus:border-red-500"
                    : "border-border/50 focus:border-primary"
                }`}
              />

              {(draftModeration.isExplicit || errorMessage) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300"
                >
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    {errorMessage ||
                      "Explicit or offensive language (English/Filipino) is automatically blocked."}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {autoDetectedSpoiler && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/35 px-2.5 py-1 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Spoiler detected — will be hidden automatically
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                    {draft.length}/1000
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !draft.trim() || draftModeration.isExplicit}
                    className="h-8 px-3 text-xs gap-1.5 font-semibold"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {submitting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Comments List */}
        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="flex gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/30 animate-pulse"
              >
                <div className="w-9 h-9 rounded-full bg-secondary/70 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-secondary/70 rounded" />
                  <div className="h-3 w-3/4 bg-secondary/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl bg-secondary/20 border border-border/30">
            <MessageSquare className="w-7 h-7 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No comments yet for Episode {episodeNumber}. Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {topLevelComments.map((comment) => {
              const replies = repliesByParentId.get(comment.id) || [];
              const isReplyingHere = replyTarget?.rootCommentId === comment.id;
              const isThreadExpanded = expandedThreads.has(comment.id) || replies.length <= 2;

              return (
                <article
                  key={comment.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors space-y-3"
                >
                  {renderCommentCard(comment, false)}

                  {/* Inline Reply Composer */}
                  {isReplyingHere && replyTarget && (
                    <form
                      onSubmit={handleSubmitReply}
                      className="ml-2.5 sm:ml-11 pl-2.5 sm:pl-3.5 border-l-2 border-primary/40 space-y-2 pt-1"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Replying to <strong className="text-white">{replyTarget.replyToName}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setReplyTarget(null)}
                          className="inline-flex items-center gap-1 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>

                      <textarea
                        value={replyDraft}
                        onChange={(e) => {
                          setReplyDraft(e.target.value);
                          if (replyError) setReplyError(null);
                        }}
                        autoFocus
                        maxLength={1000}
                        rows={2}
                        placeholder={`Reply to ${replyTarget.replyToName}...`}
                        className={`w-full rounded-xl bg-black/30 border px-3 py-2 text-xs sm:text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none transition-colors resize-y min-h-[64px] ${
                          replyModeration.isExplicit
                            ? "border-red-500/70 focus:border-red-500"
                            : "border-border/50 focus:border-primary"
                        }`}
                      />

                      {(replyModeration.isExplicit || replyError) && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          <span>
                            {replyError ||
                              "Explicit or offensive language (English/Filipino) is automatically blocked."}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {autoDetectedReplySpoiler && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Spoiler detected — will be hidden automatically
                            </span>
                          )}
                        </div>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            submittingReply ||
                            !replyDraft.trim() ||
                            replyModeration.isExplicit
                          }
                          className="h-7 px-3 text-xs gap-1 font-semibold ml-auto"
                        >
                          {submittingReply ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          {submittingReply ? "Replying..." : "Post Reply"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Nested Replies List */}
                  {replies.length > 0 && (
                    <div className="ml-2.5 sm:ml-11 pl-2.5 sm:pl-3.5 border-l-2 border-primary/25 space-y-2.5 sm:space-y-3 pt-1">
                      {replies.length > 2 && (
                        <button
                          type="button"
                          onClick={() => toggleExpandThread(comment.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {isThreadExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Hide {replies.length} replies
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              View {replies.length} replies
                            </>
                          )}
                        </button>
                      )}

                      {isThreadExpanded &&
                        replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="p-2.5 sm:p-3 rounded-lg bg-black/20 border border-border/30"
                          >
                            {renderCommentCard(reply, true)}
                          </div>
                        ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-comment-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!pendingDeleteId) setDeleteConfirm(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border/80 p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div className="space-y-1">
                <h4
                  id="delete-comment-title"
                  className="text-base font-bold text-white"
                >
                  Delete {deleteConfirm.isReply ? "Reply" : "Comment"}?
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Are you sure you want to delete this {deleteConfirm.isReply ? "reply" : "comment"}? This action cannot be undone.
                </p>
                {deleteConfirm.replyCount > 0 && (
                  <p className="text-xs font-medium text-amber-300/90 pt-0.5">
                    This will also delete {deleteConfirm.replyCount}{" "}
                    {deleteConfirm.replyCount === 1 ? "reply" : "replies"} under this comment.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={Boolean(pendingDeleteId)}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(pendingDeleteId)}
                onClick={() => handleDeleteComment(deleteConfirm.id)}
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              >
                {pendingDeleteId === deleteConfirm.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {pendingDeleteId === deleteConfirm.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Report Comment Modal */}
      {reportTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-comment-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!submittingReport) setReportTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-border/80 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 id="report-comment-title" className="text-base font-bold text-white">
                    Report Comment
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Select a reason so an admin can review this message.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submittingReport}
                onClick={() => setReportTarget(null)}
                className="text-muted-foreground hover:text-white p-1 rounded-lg transition-colors"
                aria-label="Close report dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 space-y-1">
              <p className="text-[11px] font-semibold text-primary">
                Comment by {reportTarget.author_name}
              </p>
              <p className="text-xs text-gray-300 line-clamp-3 whitespace-pre-wrap break-words">
                &ldquo;{reportTarget.content}&rdquo;
              </p>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reason for reporting
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {COMMENT_REPORT_OPTIONS.map((option) => {
                    const active = reportCategory === option.category;
                    return (
                      <button
                        key={option.category}
                        type="button"
                        onClick={() => setReportCategory(option.category)}
                        className={`text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          active
                            ? "bg-amber-500/15 border-amber-500/60 text-white"
                            : "bg-secondary/30 border-border/50 text-muted-foreground hover:text-white hover:bg-secondary/60"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white">{option.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {option.description}
                          </div>
                        </div>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                            active ? "border-amber-400 bg-amber-400" : "border-muted-foreground/50"
                          }`}
                        >
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Additional note (Optional)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Share context for the admin (e.g., manga spoiler, offensive insult)..."
                  rows={2}
                  maxLength={400}
                  className="w-full rounded-xl bg-secondary/40 border border-border/60 px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {reportError && (
                <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{reportError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submittingReport}
                  onClick={() => setReportTarget(null)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingReport}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-4 gap-1.5"
                >
                  {submittingReport ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Flag className="w-3.5 h-3.5" />
                      Submit Report
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </section>
  );
}
