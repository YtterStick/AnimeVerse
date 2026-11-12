import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { reportsApi } from "@/lib/api";
import type { CommentReport, CommentReportAction, CommentReportCategory, VideoReport } from "@/types";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Trash2,
  RefreshCw,
  Search,
  Play,
  RotateCcw,
  Clock,
  User,
  Film,
  MessageSquare,
  EyeOff,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function timeAgo(dateString: string): string {
  const d = new Date(dateString);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const CATEGORY_BADGE_MAP: Record<CommentReportCategory, { label: string; className: string }> = {
  spoiler: {
    label: "Spoiler",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/35",
  },
  bad_language: {
    label: "Bad Language",
    className: "bg-red-500/15 text-red-300 border-red-500/35",
  },
  sexual: {
    label: "Sexual / NSFW",
    className: "bg-pink-500/15 text-pink-300 border-pink-500/35",
  },
  harassment: {
    label: "Harassment",
    className: "bg-orange-500/15 text-orange-300 border-orange-500/35",
  },
  spam: {
    label: "Spam",
    className: "bg-purple-500/15 text-purple-300 border-purple-500/35",
  },
  other: {
    label: "Other",
    className: "bg-secondary text-gray-300 border-border/50",
  },
};

function getActionBadge(action: CommentReportAction | null) {
  if (action === "marked_spoiler") {
    return { label: "Marked as Spoiler", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  }
  if (action === "deleted_comment") {
    return { label: "Comment Deleted", className: "bg-red-500/15 text-red-300 border-red-500/30" };
  }
  if (action === "dismissed") {
    return { label: "Dismissed", className: "bg-secondary text-muted-foreground border-border/40" };
  }
  return null;
}

export function AdminPage() {
  const { user, session, isAdmin, loading: authLoading } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"comments" | "videos">("comments");
  const hasAutoSelectedTabRef = useRef(false);

  const [reports, setReports] = useState<VideoReport[]>([]);
  const [commentReports, setCommentReports] = useState<CommentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "resolved">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const fetchReports = useCallback(
    async (isManual = false) => {
      if (!session?.access_token || !isAdmin) return;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setErrorMsg(null);

      try {
        const [videoRes, commentRes] = await Promise.all([
          reportsApi.getReports(session.access_token),
          reportsApi.getCommentReports(session.access_token),
        ]);
        const vList = videoRes.data || [];
        const cList = commentRes.data || [];
        setReports(vList);
        setCommentReports(cList);

        if (!hasAutoSelectedTabRef.current) {
          hasAutoSelectedTabRef.current = true;
          const openComments = cList.filter((r) => r.status === "open").length;
          const openVideos = vList.filter((r) => r.status === "open").length;
          if (openComments === 0 && openVideos > 0) {
            setActiveTab("videos");
          } else {
            setActiveTab("comments");
          }
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to load reports. Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session?.access_token, isAdmin]
  );

  useEffect(() => {
    if (isAdmin && session?.access_token) {
      fetchReports();
    }
  }, [isAdmin, session?.access_token, fetchReports]);

  const handleToggleStatus = async (report: VideoReport) => {
    if (!session?.access_token) return;
    const nextStatus = report.status === "open" ? "resolved" : "open";
    setActionInProgress(report.id);

    try {
      await reportsApi.updateStatus(session.access_token, report.id, nextStatus);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                status: nextStatus,
                updated_at: new Date().toISOString(),
                resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null,
              }
            : r
        )
      );
      toast.success(nextStatus === "resolved" ? "Video report marked fixed" : "Video report reopened");
    } catch (err: any) {
      toast.error(err?.message || "Error updating video report");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = (reportId: string) => {
    if (!session?.access_token) return;
    setConfirmState({
      title: "Delete Video Report?",
      message: "Remove this video issue report entry permanently?",
      confirmLabel: "Delete Report",
      onConfirm: async () => {
        setActionInProgress(reportId);
        try {
          await reportsApi.deleteReport(session.access_token, reportId);
          setReports((prev) => prev.filter((r) => r.id !== reportId));
          toast.info("Video report deleted");
        } catch (err: any) {
          toast.error(err?.message || "Error deleting report");
        } finally {
          setActionInProgress(null);
        }
      },
    });
  };

  const handleProcessCommentReport = async (
    report: CommentReport,
    action: CommentReportAction | "reopen"
  ) => {
    if (!session?.access_token) return;

    if (action === "deleted_comment") {
      setConfirmState({
        title: "Delete Offending Comment?",
        message: `This will permanently delete ${report.comment_author}'s comment (and any replies) from Episode ${report.episode_number} and mark this report resolved.`,
        confirmLabel: "Delete Comment",
        onConfirm: async () => {
          setActionInProgress(report.id);
          try {
            const res = await reportsApi.processCommentReport(
              session.access_token,
              report.id,
              "deleted_comment"
            );
            setCommentReports((prev) =>
              prev.map((r) => (r.id === report.id ? res.data : r))
            );
            toast.success("Comment deleted & report resolved");
          } catch (err: any) {
            toast.error(err?.message || "Failed to delete comment");
          } finally {
            setActionInProgress(null);
          }
        },
      });
      return;
    }

    setActionInProgress(report.id);
    try {
      const res = await reportsApi.processCommentReport(session.access_token, report.id, action);
      setCommentReports((prev) => prev.map((r) => (r.id === report.id ? res.data : r)));
      if (action === "marked_spoiler") {
        toast.success("Comment marked as spoiler & report resolved");
      } else if (action === "dismissed") {
        toast.info("Comment report dismissed");
      } else {
        toast.info("Comment report reopened");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to process comment report");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteCommentReport = (reportId: string) => {
    if (!session?.access_token) return;
    setConfirmState({
      title: "Delete Report Log?",
      message: "Remove this comment report log entry from the dashboard?",
      confirmLabel: "Delete Entry",
      onConfirm: async () => {
        setActionInProgress(reportId);
        try {
          await reportsApi.deleteCommentReport(session.access_token, reportId);
          setCommentReports((prev) => prev.filter((r) => r.id !== reportId));
          toast.info("Comment report log deleted");
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete comment report");
        } finally {
          setActionInProgress(null);
        }
      },
    });
  };

  const handleClearResolved = () => {
    if (!session?.access_token) return;
    if (activeTab === "comments") {
      const resolvedCount = commentReports.filter((r) => r.status === "resolved").length;
      if (resolvedCount === 0) return;
      setConfirmState({
        title: `Clear ${resolvedCount} Resolved Comment Report(s)?`,
        message: "This removes resolved comment report logs from the list.",
        confirmLabel: "Clear Resolved",
        onConfirm: async () => {
          setRefreshing(true);
          try {
            await reportsApi.deleteCommentReport(session.access_token, "resolved");
            setCommentReports((prev) => prev.filter((r) => r.status !== "resolved"));
            toast.info("Cleared resolved comment reports");
          } catch (err: any) {
            toast.error(err?.message || "Error clearing resolved reports");
          } finally {
            setRefreshing(false);
          }
        },
      });
      return;
    }

    const resolvedCount = reports.filter((r) => r.status === "resolved").length;
    if (resolvedCount === 0) return;
    setConfirmState({
      title: `Clear ${resolvedCount} Resolved Video Report(s)?`,
      message: "This removes resolved video report logs from the list.",
      confirmLabel: "Clear Resolved",
      onConfirm: async () => {
        setRefreshing(true);
        try {
          await reportsApi.deleteReport(session.access_token, "resolved");
          setReports((prev) => prev.filter((r) => r.status !== "resolved"));
          toast.info("Cleared resolved video reports");
        } catch (err: any) {
          toast.error(err?.message || "Error clearing resolved reports");
        } finally {
          setRefreshing(false);
        }
      },
    });
  };

  const videoStats = useMemo(() => {
    const total = reports.length;
    const open = reports.filter((r) => r.status === "open").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;

    const countsByAnime: Record<string, number> = {};
    for (const r of reports.filter((x) => x.status === "open")) {
      countsByAnime[r.anime_title] = (countsByAnime[r.anime_title] || 0) + (r.report_count || 1);
    }
    const mostReported = Object.entries(countsByAnime).sort((a, b) => b[1] - a[1])[0];

    return { total, open, resolved, highlight: mostReported?.[0] || "None" };
  }, [reports]);

  const commentStats = useMemo(() => {
    const total = commentReports.length;
    const open = commentReports.filter((r) => r.status === "open").length;
    const resolved = commentReports.filter((r) => r.status === "resolved").length;

    const countsByReason: Record<string, number> = {};
    for (const r of commentReports.filter((x) => x.status === "open")) {
      const label = CATEGORY_BADGE_MAP[r.category]?.label || r.reason;
      countsByReason[label] = (countsByReason[label] || 0) + (r.report_count || 1);
    }
    const topReason = Object.entries(countsByReason).sort((a, b) => b[1] - a[1])[0];

    return { total, open, resolved, highlight: topReason?.[0] || "None" };
  }, [commentReports]);

  const stats = activeTab === "comments" ? commentStats : videoStats;

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterStatus === "open" && r.status !== "open") return false;
      if (filterStatus === "resolved" && r.status !== "resolved") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = r.anime_title.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        const matchServer = r.server_name.toLowerCase().includes(q);
        const matchEp = String(r.episode_number) === q || `ep ${r.episode_number}`.includes(q);
        if (!matchTitle && !matchReason && !matchServer && !matchEp) return false;
      }

      return true;
    });
  }, [reports, filterStatus, searchQuery]);

  const filteredCommentReports = useMemo(() => {
    return commentReports.filter((r) => {
      if (filterStatus === "open" && r.status !== "open") return false;
      if (filterStatus === "resolved" && r.status !== "resolved") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = r.anime_title.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        const matchAuthor = r.comment_author.toLowerCase().includes(q);
        const matchContent = r.comment_content.toLowerCase().includes(q);
        const matchEp = String(r.episode_number) === q || `ep ${r.episode_number}`.includes(q);
        if (!matchTitle && !matchReason && !matchAuthor && !matchContent && !matchEp) return false;
      }

      return true;
    });
  }, [commentReports, filterStatus, searchQuery]);

  // If user is loading or not admin
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-white">Admin Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This dashboard is reserved for site administrators. Please sign in with the authorized admin account (
          <span className="text-white font-semibold">andreidilag12@gmail.com</span>).
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button asChild variant="default" className="rounded-full bg-primary font-bold">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full pb-20 page-enter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Moderation &amp; Issue Reports
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  Admin Control
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Process reported comments (spoilers, offensive, sexual content) and verify broken video streams.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => fetchReports(true)}
              className="rounded-xl border-border/60 hover:bg-secondary text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {stats.resolved > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClearResolved}
                className="rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear Resolved ({stats.resolved})
              </Button>
            )}
          </div>
        </div>

        {/* Primary Dashboard Switcher: Comment Reports vs Video Stream Issues */}
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("comments");
              setFilterStatus("open");
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "comments"
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-white hover:bg-secondary/60"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Reported Comments</span>
            {commentStats.open > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black animate-pulse">
                {commentStats.open}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("videos");
              setFilterStatus("open");
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "videos"
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-white hover:bg-secondary/60"
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Broken Video Streams</span>
            {videoStats.open > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black">
                {videoStats.open}
              </span>
            )}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {activeTab === "comments" ? "Comment Reports" : "Video Reports"}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
            <p className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider">
              Pending Review
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-300">{stats.open}</p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
            <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-wider">Resolved</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-300">{stats.resolved}</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              {activeTab === "comments" ? "Top Violation" : "Top Reported Anime"}
            </p>
            <p className="text-sm font-bold text-white truncate pt-1">{stats.highlight}</p>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/30 border border-border/40 p-3 rounded-2xl">
          {/* Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterStatus("open")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "open"
                  ? "bg-amber-500 text-black shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-secondary/60"
              }`}
            >
              Open ({stats.open})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "all"
                  ? "bg-primary text-white shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-secondary/60"
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("resolved")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "resolved"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-secondary/60"
              }`}
            >
              Resolved ({stats.resolved})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "comments"
                  ? "Search comment text, author, anime..."
                  : "Filter by anime title or ep..."
              }
              className="w-full bg-secondary/40 border border-border/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === "comments" ? (
          /* Reported Comments View */
          filteredCommentReports.length === 0 ? (
            <div className="text-center py-16 space-y-3 border border-border/30 rounded-2xl bg-card/20">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">No comment reports</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {filterStatus === "open"
                  ? "Awesome! There are no pending comment moderation reports."
                  : "No comment reports match your current filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredCommentReports.map((report) => {
                const isResolved = report.status === "resolved";
                const isBusy = actionInProgress === report.id;
                const badge =
                  CATEGORY_BADGE_MAP[report.category] || CATEGORY_BADGE_MAP.other;
                const actionBadge = getActionBadge(report.action_taken);

                return (
                  <div
                    key={report.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3.5 ${
                      isResolved
                        ? "bg-card/20 border-border/30 opacity-80"
                        : "bg-card/50 border-border/60 hover:border-amber-500/40 shadow-lg"
                    }`}
                  >
                    {/* Top Row: Anime, Episode, Category Badge, Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {report.anime_image ? (
                          <img
                            src={report.anime_image}
                            alt={report.anime_title}
                            className="w-11 h-15 object-cover rounded-xl shrink-0 border border-border/40"
                          />
                        ) : (
                          <div className="w-11 h-15 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border/40 text-muted-foreground">
                            <Film className="w-5 h-5" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/anime/${report.anime_id}`}
                              className="text-sm sm:text-base font-bold text-white hover:text-primary transition-colors truncate"
                            >
                              {report.anime_title}
                            </Link>
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[10px] font-extrabold">
                              Episode {report.episode_number}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {report.report_count > 1 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                                <Flag className="w-3 h-3 text-amber-400" />
                                {report.report_count} Reports
                              </span>
                            )}
                            {actionBadge && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${actionBadge.className}`}
                              >
                                {actionBadge.label}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Author: <strong className="text-white">{report.comment_author}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Status & Time */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            isResolved
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-red-500/20 text-red-300 border border-red-500/40"
                          }`}
                        >
                          {isResolved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Resolved
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              Needs Review
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(report.updated_at || report.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Reported Comment Content Box */}
                    <div className="bg-black/40 border border-border/60 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-primary">Comment Content:</span>
                        {report.comment_is_spoiler && (
                          <span className="text-amber-300 flex items-center gap-1 font-semibold text-[10px]">
                            <EyeOff className="w-3 h-3" /> Already Hidden As Spoiler
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                        &ldquo;{report.comment_content}&rdquo;
                      </p>
                    </div>

                    {/* Viewer Details / Note */}
                    {report.details && report.details.trim().length > 0 && (
                      <div className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5">
                          Reporter Note ({report.reason}):
                        </span>
                        &ldquo;{report.details}&rdquo;
                      </div>
                    )}

                    {/* Bottom Action Bar for Comments */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>
                          Reporter: <strong className="text-white/80">{report.reporter_email}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Go to Episode in new tab */}
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-border/60 text-xs font-semibold cursor-pointer"
                        >
                          <Link
                            to={`/watch/${report.anime_id}/${report.episode_number}`}
                            target="_blank"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            View Episode
                          </Link>
                        </Button>

                        {!isResolved ? (
                          <>
                            {/* Action 1: Mark comment as spoiler */}
                            <Button
                              type="button"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleProcessCommentReport(report, "marked_spoiler")}
                              className="rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
                            >
                              <EyeOff className="w-3.5 h-3.5 mr-1" />
                              Mark as Spoiler
                            </Button>

                            {/* Action 2: Delete offending comment */}
                            <Button
                              type="button"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleProcessCommentReport(report, "deleted_comment")}
                              className="rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete Comment
                            </Button>

                            {/* Action 3: Dismiss false alarm */}
                            <Button
                              type="button"
                              size="sm"
                              disabled={isBusy}
                              variant="secondary"
                              onClick={() => handleProcessCommentReport(report, "dismissed")}
                              className="rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              Dismiss Report
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy}
                            variant="outline"
                            onClick={() => handleProcessCommentReport(report, "reopen")}
                            className="rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Reopen
                          </Button>
                        )}

                        {/* Delete Report entry */}
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleDeleteCommentReport(report.id)}
                          variant="ghost"
                          className="rounded-xl text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          title="Delete report log entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Broken Video Streams View */
          filteredReports.length === 0 ? (
            <div className="text-center py-16 space-y-3 border border-border/30 rounded-2xl bg-card/20">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">No reports found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {filterStatus === "open"
                  ? "Awesome! All anime video streams are currently running with zero open reports."
                  : "No video reports match your current filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const isResolved = report.status === "resolved";
                const isBusy = actionInProgress === report.id;

                return (
                  <div
                    key={report.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3 ${
                      isResolved
                        ? "bg-card/20 border-border/30 opacity-75"
                        : "bg-card/50 border-border/60 hover:border-amber-500/40 shadow-lg"
                    }`}
                  >
                    {/* Top Bar: Title, Episode, Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {report.anime_image ? (
                          <img
                            src={report.anime_image}
                            alt={report.anime_title}
                            className="w-12 h-16 object-cover rounded-xl shrink-0 border border-border/40"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border/40 text-muted-foreground">
                            <Film className="w-5 h-5" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/anime/${report.anime_id}`}
                              className="text-sm sm:text-base font-bold text-white hover:text-primary transition-colors truncate"
                            >
                              {report.anime_title}
                            </Link>
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[10px] font-extrabold">
                              Episode {report.episode_number}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-secondary/80 text-foreground border border-border/40 text-[10px] font-semibold">
                              {report.server_name} ({report.category})
                            </span>
                            {report.report_count > 1 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                Reported {report.report_count}x
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`font-semibold px-2.5 py-0.5 rounded-lg text-xs ${
                                isResolved
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {report.reason}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            isResolved
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-red-500/20 text-red-300 border border-red-500/40"
                          }`}
                        >
                          {isResolved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Resolved
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              Open Issue
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(report.updated_at || report.created_at)}
                        </span>
                      </div>
                    </div>

                    {report.details &&
                      report.details.trim().length > 0 &&
                      report.details !== "Verified test issue" && (
                        <div className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-xs text-muted-foreground">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-0.5">
                            Viewer Note:
                          </span>
                          &ldquo;
                          {report.details
                            .replace(/Verified test issue/gi, "")
                            .replace(/^\|\s*|\s*\|$/g, "")
                            .trim()}
                          &rdquo;
                        </div>
                      )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>
                          Reporter: <strong className="text-white/80">{report.reporter_email}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          asChild
                          size="sm"
                          className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs cursor-pointer shadow-md"
                        >
                          <Link to={`/watch/${report.anime_id}/${report.episode_number}`} target="_blank">
                            <Play className="w-3.5 h-3.5 mr-1 fill-white" />
                            Watch &amp; Test Episode
                            <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                          </Link>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleToggleStatus(report)}
                          variant={isResolved ? "outline" : "secondary"}
                          className={`rounded-xl text-xs font-semibold cursor-pointer ${
                            isResolved
                              ? "border-border/60 hover:bg-secondary text-muted-foreground"
                              : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                          }`}
                        >
                          {isResolved ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                              Reopen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                              Mark Fixed
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleDelete(report.id)}
                          variant="ghost"
                          className="rounded-xl text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          title="Delete this report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Themed Confirmation Modal */}
      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border/80 p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">{confirmState.title}</h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmState(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={async () => {
                  const fn = confirmState.onConfirm;
                  setConfirmState(null);
                  await fn();
                }}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
