import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonBanner() {
  return (
    <div className="w-full aspect-[16/9] md:aspect-[21/9] max-h-[70vh] bg-card/30 relative flex items-end border-b border-border/20 skeleton-shimmer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-8 md:pb-16 z-10 space-y-4">
        {/* Title */}
        <Skeleton className="h-8 md:h-12 w-2/3 md:w-1/2 bg-muted/60" />
        
        {/* Synopsis excerpt */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-5/6 md:w-2/3 bg-muted/40" />
          <Skeleton className="h-4 w-4/5 md:w-1/2 bg-muted/40" />
        </div>

        {/* CTAs */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 w-28 md:w-32 rounded-full bg-muted/60" />
          <Skeleton className="h-10 w-28 md:w-32 rounded-full bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonBanner;
