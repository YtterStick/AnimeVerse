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
import { Heart, LogOut } from "lucide-react";

export function UserMenu() {
  const { user, signOut } = useAuth();
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
  const name = user.user_metadata?.full_name || email;
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const avatarUrl = user.user_metadata?.avatar_url || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none cursor-pointer rounded-full p-0.5 border border-border/40 hover:border-primary/60 transition-all select-none">
        <Avatar className="w-8 h-8">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card border border-border/80 text-foreground p-1.5 rounded-xl shadow-xl mt-1.5" align="end">
        <DropdownMenuLabel className="font-normal px-2.5 py-2">
          <div className="flex flex-col space-y-1">
            <p className="text-xs font-semibold text-white leading-tight truncate">
              {name}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/40 my-1" />
        
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
