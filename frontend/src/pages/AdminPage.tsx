import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { reportsApi } from "@/lib/api";
import type { VideoReport } from "@/types";
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

export function AdminPage() {
  const { user, session, isAdmin, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<VideoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "resolved">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchReports = useCallback(
    async (isManual = false) => {
      if (!session?.access_token || !isAdmin) return;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setErrorMsg(null);

      try {
        const res = await reportsApi.getReports(session.access_token);
        setReports(res.data || []);
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
    } catch (err: any) {
      alert(`Error updating report: ${err?.message || "Unknown error"}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to delete this report?")) return;

    setActionInProgress(reportId);
    try {
      await reportsApi.deleteReport(session.access_token, reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err: any) {
      alert(`Error deleting report: ${err?.message || "Unknown error"}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClearResolved = async () => {
    if (!session?.access_token) return;
    const resolvedCount = reports.filter((r) => r.status === "resolved").length;
    if (resolvedCount === 0) return;
    if (!confirm(`Delete all ${resolvedCount} resolved report(s)?`)) return;

    setRefreshing(true);
    try {
      await reportsApi.deleteReport(session.access_token, "resolved");
      setReports((prev) => prev.filter((r) => r.status !== "resolved"));
    } catch (err: any) {
      alert(`Error clearing resolved reports: ${err?.message || "Unknown error"}`);
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const total = reports.length;
    const open = reports.filter((r) => r.status === "open").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;

    // Find most reported anime
    const countsByAnime: Record<string, number> = {};
    for (const r of reports.filter((x) => x.status === "open")) {
      countsByAnime[r.anime_title] = (countsByAnime[r.anime_title] || 0) + (r.report_count || 1);
    }
    const mostReported = Object.entries(countsByAnime).sort((a, b) => b[1] - a[1])[0];

    return { total, open, resolved, mostReportedTitle: mostReported?.[0] || "None" };
  }, [reports]);

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
                Video Issue Reports
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  Admin Control
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Review and test broken episodes reported by viewers to keep streams working 100%.
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Reports</p>
            <p className="text-2xl sm:text-3xl font-black text-white">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
            <p className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider">Open Issues</p>
            <p className="text-2xl sm:text-3xl font-black text-amber-300">{stats.open}</p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
            <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-wider">Resolved</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-300">{stats.resolved}</p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Top Reported
            </p>
            <p className="text-sm font-bold text-white truncate pt-1">{stats.mostReportedTitle}</p>
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
              placeholder="Filter by anime title or ep..."
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
        ) : filteredReports.length === 0 ? (
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
          /* Report List */
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

                        {/* Reported Issue Tag */}
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

                    {/* Status Pill & Timestamp */}
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

                  {/* User Details box (if any) */}
                  {report.details &&
                    report.details.trim().length > 0 &&
                    report.details !== "Verified test issue" && (
                      <div className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-0.5">
                          Viewer Note:
                        </span>
                        &ldquo;{report.details.replace(/Verified test issue/gi, "").replace(/^\|\s*|\s*\|$/g, "").trim()}&rdquo;
                      </div>
                    )}

                  {/* Bottom Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span>Reporter: <strong className="text-white/80">{report.reporter_email}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Watch & Test Episode in player */}
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

                      {/* Mark Resolved / Reopen */}
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

                      {/* Delete */}
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
        )}
      </div>
    </div>
  );
}

export default AdminPage;
