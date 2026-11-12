import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLayout } from "@/contexts/LayoutContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, History, LogOut, ShieldAlert, Tv, User as UserIcon } from "lucide-react";

export function UserMenu() {
  const { user, signOut, displayName, avatarUrl, isAdmin } = useAuth();
  const { tvMode, toggleTvMode } = useLayout();
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
    <DropdownMenu modal={false}>
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
              <p className="text-xs font-semibold text-white leading-tight truncate">
                {name}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/40 my-1" />

        {isAdmin && (
          <>
            <DropdownMenuItem asChild className="focus:bg-amber-500/20 focus:text-amber-300 text-amber-400 font-bold cursor-pointer rounded-lg px-2.5 py-2 text-xs">
              <Link to="/admin" className="flex items-center w-full">
                <ShieldAlert className="w-4 h-4 mr-2.5 text-amber-400" />
                Admin Dashboard (Reports)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40 my-1" />
          </>
        )}

        <DropdownMenuItem asChild className="focus:bg-primary/15 focus:text-primary cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium">
          <Link to="/profile" className="flex items-center w-full">
            <UserIcon className="w-4 h-4 mr-2.5 text-primary" />
            Profile &amp; Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={toggleTvMode}
          className="focus:bg-purple-500/15 focus:text-purple-300 cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center">
            <Tv className="w-4 h-4 mr-2.5 text-purple-400" />
            <span>TV Mode Layout</span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              tvMode
                ? "bg-purple-500/30 text-purple-200 border border-purple-500/50"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {tvMode ? "ON" : "OFF"}
          </span>
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
