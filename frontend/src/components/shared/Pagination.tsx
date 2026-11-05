import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages?: number;
  hasNextPage?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages = 1,
  hasNextPage = false,
  onPageChange,
  className = "",
}: PaginationProps) {
  // If only 1 page and no next page, don't show pagination
  if (totalPages <= 1 && !hasNextPage) return null;

  const maxPages = hasNextPage
    ? Math.max(totalPages, currentPage + 1)
    : Math.max(totalPages, currentPage);

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (maxPages <= 7) {
      for (let i = 1; i <= maxPages; i++) pages.push(i);
    } else {
      // Prevent phantom jumps to distant unverified pages:
      const visibleMax =
        hasNextPage && totalPages > currentPage + 5
          ? currentPage + 2
          : maxPages;

      pages.push(1);
      if (currentPage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(visibleMax - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < visibleMax - 2) {
        pages.push("...");
      }
      if (visibleMax > 1 && !pages.includes(visibleMax)) {
        pages.push(visibleMax);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();
  const canGoPrev = currentPage > 1;
  const canGoNext = hasNextPage || currentPage < maxPages;

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-8 border-t border-border/30 w-full ${className}`}
    >
      <div className="text-xs text-muted-foreground order-2 sm:order-1">
        Showing Page <span className="font-semibold text-white">{currentPage}</span>
        {maxPages > 1 && (
          <>
            {" "}of{" "}
            <span className="font-semibold text-white">
              {maxPages}
              {hasNextPage ? "+" : ""}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        <button
          type="button"
          onClick={() => canGoPrev && onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            canGoPrev
              ? "bg-secondary/60 hover:bg-secondary text-foreground border-border/50 hover:border-border cursor-pointer active:scale-95"
              : "opacity-30 border-border/20 text-muted-foreground cursor-not-allowed pointer-events-none"
          }`}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, idx) =>
            p === "..." ? (
              <span
                key={`dots-${idx}`}
                className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground select-none"
              >
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center ${
                  p === currentPage
                    ? "bg-primary text-white border-primary shadow-sm shadow-primary/30 font-bold scale-105"
                    : "bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/40 hover:border-border"
                }`}
                aria-current={p === currentPage ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            canGoNext
              ? "bg-secondary/60 hover:bg-secondary text-foreground border-border/50 hover:border-border cursor-pointer active:scale-95"
              : "opacity-30 border-border/20 text-muted-foreground cursor-not-allowed pointer-events-none"
          }`}
          aria-label="Go to next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;

