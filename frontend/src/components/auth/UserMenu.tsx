import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, History, LogOut, User as UserIcon, Sparkles } from "lucide-react";

export function UserMenu() {
  const { user, signOut, displayName, avatarUrl } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  if (!user) return null;

  // Derive initial letters for fallback avatar
  const email = user.email || "";
  const name = displayName || email;
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none cursor-pointer rounded-full p-0.5 border border-border/50 hover:border-primary transition-all select-none hover:scale-105 active:scale-95 duration-200">
        <Avatar className="w-8 h-8 ring-1 ring-white/10">
          <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
          <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 bg-card/95 backdrop-blur-xl border border-border/80 text-foreground p-1.5 rounded-xl shadow-2xl mt-1.5 animate-in fade-in zoom-in-95 duration-150" align="end">
        <DropdownMenuLabel className="font-normal px-2.5 py-2">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-9 h-9 shrink-0 ring-1 ring-border/40">
              <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0.5 min-w-0">
              <p className="text-xs font-bold text-white leading-tight truncate flex items-center gap-1">
                <span>{name}</span>
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/40 my-1" />

        <DropdownMenuItem asChild className="focus:bg-primary/15 focus:text-primary cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium">
          <Link to="/profile" className="flex items-center w-full">
            <UserIcon className="w-4 h-4 mr-2.5 text-primary" />
            Profile &amp; Avatar
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild className="focus:bg-secondary/60 focus:text-foreground cursor-pointer rounded-lg px-2.5 py-2 text-xs">
          <Link to="/history" className="flex items-center w-full">
            <History className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Watch History
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="focus:bg-secondary/60 focus:text-foreground cursor-pointer rounded-lg px-2.5 py-2 text-xs">
          <Link to="/watchlist" className="flex items-center w-full">
            <Heart className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Watchlist Favorites
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border/40 my-1" />
        
        <DropdownMenuItem
          onClick={handleSignOut}
          className="focus:bg-destructive/10 focus:text-red-400 text-red-500 cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
        >
          <LogOut className="w-4 h-4 mr-2.5 text-red-500/80" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
