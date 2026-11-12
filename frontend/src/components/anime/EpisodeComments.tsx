import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { commentsApi, getOrCreateGuestId } from "@/lib/api";
import { generateRandomAnimeProfile } from "@/lib/avatars";
import { detectSpoilerContent, moderateCommentContent } from "@/lib/contentModeration";
import type { EpisodeDiscussion, ReactionType } from "@/types";

interface EpisodeCommentsProps {
  animeId: number;
  episodeNumber: number;
}

const REACTION_OPTIONS: Array<{
  type: ReactionType;
  emoji: string;
  label: string;
}> = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "fire", emoji: "🔥", label: "Hype" },
  { type: "funny", emoji: "😂", label: "Funny" },
  { type: "sad", emoji: "😢", label: "Cry" },
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

export function EpisodeComments({ animeId, episodeNumber }: EpisodeCommentsProps) {
  const { user, session, displayName, avatarUrl } = useAuth();
  const [discussion, setDiscussion] = useState<EpisodeDiscussion>(EMPTY_DISCUSSION);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [markSpoiler, setMarkSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [pendingReact, setPendingReact] = useState<ReactionType | null>(null);
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const guestProfile = useMemo(
    () => generateRandomAnimeProfile(getOrCreateGuestId()),
    []
  );

  const activeName = user ? displayName || guestProfile.username : guestProfile.username;
  const activeAvatar = user ? avatarUrl || guestProfile.avatarUrl : guestProfile.avatarUrl;
  const token = session?.access_token ?? null;

  // Live moderation check on draft so explicit language is flagged immediately
  const draftModeration = useMemo(
    () => moderateCommentContent(draft, markSpoiler),
    [draft, markSpoiler]
  );
  const autoDetectedSpoiler = useMemo(
    () => !markSpoiler && draft.trim().length > 0 && detectSpoilerContent(draft),
    [draft, markSpoiler]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage(null);
    setRevealedIds(new Set());

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
    };
  }, [animeId, episodeNumber, token]);

  const handleToggleReaction = async (type: ReactionType) => {
    if (pendingReact) return;
    const prev = discussion;
    const alreadyActive = prev.userReactions.includes(type);

    // Optimistic update
    setDiscussion({
      ...prev,
      reactions: {
        ...prev.reactions,
        [type]: Math.max(0, (prev.reactions[type] || 0) + (alreadyActive ? -1 : 1)),
      },
      userReactions: alreadyActive
        ? prev.userReactions.filter((r) => r !== type)
        : [...prev.userReactions, type],
    });

    setPendingReact(type);
    try {
      const updated = await commentsApi.toggleVideoReaction(
        animeId,
        episodeNumber,
        type,
        token
      );
      setDiscussion(updated);
    } catch {
      setDiscussion(prev);
    } finally {
      setPendingReact(null);
    }
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
      setMarkSpoiler(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to post comment right now. Please try again.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (pendingLikeId === commentId) return;
    const prev = discussion;

    setDiscussion({
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
    });

    setPendingLikeId(commentId);
    try {
      const updated = await commentsApi.toggleCommentLike(
        animeId,
        episodeNumber,
        commentId,
        token
      );
      setDiscussion(updated);
    } catch {
      setDiscussion(prev);
    } finally {
      setPendingLikeId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (pendingDeleteId === commentId) return;
    setPendingDeleteId(commentId);
    try {
      const updated = await commentsApi.deleteComment(
        animeId,
        episodeNumber,
        commentId,
        token
      );
      setDiscussion(updated);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not delete comment."
      );
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

  const totalReactions = REACTION_OPTIONS.reduce(
    (sum, item) => sum + (discussion.reactions[item.type] || 0),
    0
  );

  return (
    <section
      className="mt-6 rounded-2xl bg-card/40 border border-border/50 p-4 sm:p-6 space-y-6"
      aria-label="Episode reactions and comments"
    >
      {/* Episode Reactions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/40">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            Episode {episodeNumber} Reactions
            {totalReactions > 0 && (
              <span className="text-xs font-medium text-muted-foreground bg-secondary/70 px-2 py-0.5 rounded-full">
                {totalReactions}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share how you feel about this episode
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {REACTION_OPTIONS.map(({ type, emoji, label }) => {
            const count = discussion.reactions[type] || 0;
            const active = discussion.userReactions.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleToggleReaction(type)}
                disabled={pendingReact !== null}
                aria-pressed={active}
                title={label}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  active
                    ? "bg-primary/20 border-primary/60 text-white shadow-sm shadow-primary/20"
                    : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-white hover:border-border hover:bg-secondary/80"
                }`}
              >
                <span className="text-sm leading-none" aria-hidden="true">
                  {emoji}
                </span>
                <span>{label}</span>
                {count > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${
                      active ? "bg-primary/30 text-white" : "bg-black/30 text-gray-300"
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

      {/* Comments Header & Composer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Comments ({discussion.comments.length})
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Profanity auto-blocked • Spoilers hidden
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="w-9 h-9 border border-primary/30 shrink-0 mt-0.5">
              {activeAvatar ? (
                <AvatarImage src={activeAvatar} alt={activeName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {activeName[0]?.toUpperCase() || "A"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                rows={3}
                placeholder="Join the discussion about this episode... (Keep it respectful; spoilers will be hidden)"
                className={`w-full rounded-xl bg-secondary/50 border px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none transition-colors resize-y min-h-[82px] ${
                  draftModeration.isExplicit
                    ? "border-red-500/70 focus:border-red-500"
                    : "border-border/50 focus:border-primary"
                }`}
              />

              {/* Live explicit warning */}
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

              {/* Composer footer */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMarkSpoiler((v) => !v)}
                    aria-pressed={markSpoiler}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      markSpoiler
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-white"
                    }`}
                  >
                    {markSpoiler ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>{markSpoiler ? "Marked as Spoiler" : "Contains Spoiler"}</span>
                  </button>

                  {autoDetectedSpoiler && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 px-2 py-1 rounded-lg">
                      <AlertTriangle className="w-3 h-3" />
                      Spoiler detected — will hide automatically
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-[11px] text-muted-foreground">
                    {draft.length}/1000
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !draft.trim() || draftModeration.isExplicit}
                    className="gap-1.5 font-semibold"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {submitting ? "Posting..." : "Post Comment"}
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
        ) : discussion.comments.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl bg-secondary/20 border border-border/30">
            <MessageSquare className="w-7 h-7 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No comments yet for Episode {episodeNumber}. Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {discussion.comments.map((comment) => {
              const isRevealed = revealedIds.has(comment.id);
              const showMasked = comment.is_spoiler && !isRevealed;

              return (
                <article
                  key={comment.id}
                  className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors"
                >
                  <Avatar className="w-9 h-9 border border-border/60 shrink-0 mt-0.5">
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
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

                      {comment.can_delete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={pendingDeleteId === comment.id}
                          title="Delete comment"
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Comment body with Spoiler Masking */}
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
                      <div className="space-y-2">
                        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex items-center gap-3 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleCommentLike(comment.id)}
                        disabled={pendingLikeId === comment.id}
                        aria-pressed={comment.liked_by_me}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                          comment.liked_by_me
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-white hover:bg-secondary/70"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{comment.likes_count > 0 ? comment.likes_count : "Like"}</span>
                      </button>

                      {comment.is_spoiler && isRevealed && (
                        <button
                          type="button"
                          onClick={() => toggleRevealSpoiler(comment.id)}
                          className="inline-flex items-center gap-1 text-xs text-amber-300/80 hover:text-amber-200 px-2 py-1 rounded-md hover:bg-amber-500/10 transition-colors"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Hide Spoiler
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </section>
  );
}
