interface GenreBadgeProps {
  name: string;
}

export function GenreBadge({ name }: GenreBadgeProps) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/80 text-foreground border border-border/40 hover:bg-primary/20 hover:text-primary transition-all duration-300 cursor-pointer">
      {name}
    </span>
  );
}

export default GenreBadge;
