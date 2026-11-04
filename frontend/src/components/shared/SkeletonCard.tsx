import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard() {
  return (
    <div className="flex flex-col w-full bg-card/40 rounded-xl overflow-hidden border border-border/20 shadow-sm p-0">
      {/* Image Poster Placeholder */}
      <div className="aspect-[2/3] w-full relative overflow-hidden bg-muted/50 skeleton-shimmer" />

      {/* Info Content Placeholder */}
      <div className="p-3 space-y-2.5">
        {/* Title */}
        <Skeleton className="h-4 w-5/6 bg-muted/60" />
        
        {/* Genres */}
        <div className="flex gap-1.5 mt-1">
          <Skeleton className="h-3 w-1/3 bg-muted/40" />
          <Skeleton className="h-3 w-1/4 bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonCard;
