import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useWatchHistory, useWatchlist } from "@/hooks/useWatchHistory";
import { getAvatarByUrl, DEFAULT_AVATAR } from "@/lib/avatars";
import { AvatarPickerModal } from "@/components/profile/AvatarPickerModal";
import { TitleLanguageToggle } from "@/components/shared/TitleLanguageToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera,
  History,
  Heart,
  LogOut,
  Check,
  Tv,
  Monitor,
  Sliders,
} from "lucide-react";

export function ProfilePage() {
  const { user, signOut, displayName, avatarUrl, updateProfile } = useAuth();
  const { tvMode, setTvMode } = useLayout();
  const { history } = useWatchHistory();
  const { watchlist } = useWatchlist();

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Profile & Avatar • AniVerse";
  }, []);

  const currentAvatarInfo = getAvatarByUrl(avatarUrl) || {
    name: "Totoro",
    series: "My Neighbor Totoro",
    category: "Studio Ghibli",
    url: DEFAULT_AVATAR,
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    try {
      setSavingName(true);
      await updateProfile({ username: trimmed });
      setIsEditingName(false);
      showToast("Username updated");
    } catch (err) {
      console.error("Failed to update username:", err);
      showToast("Failed to update username");
    } finally {
      setSavingName(false);
    }
  };

  const handleSelectAvatar = async (newUrl: string) => {
    try {
      await updateProfile({ avatarUrl: newUrl });
      showToast("Avatar updated");
    } catch (err) {
      console.error("Failed to update avatar:", err);
      showToast("Failed to update avatar");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast("Signed out");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const openAuth = (tab: "signin" | "signup") => {
    setAuthTab(tab);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 flex-1 flex flex-col page-enter">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-foreground shadow-lg animate-in slide-in-from-bottom-3 duration-150">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Check className="w-3 h-3" />
          </div>
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border/20 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Profile
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your account settings, avatar, and viewing preferences.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-card border border-border/40 rounded-2xl p-6 sm:p-7 space-y-6">
        {/* Top: Avatar & User Identity */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-border/30">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar (clickable to open Avatar Picker) */}
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              aria-label="Change avatar"
              title="Click to change avatar"
              className="group relative w-20 h-20 sm:w-22 sm:h-22 rounded-full overflow-hidden border border-border/60 hover:border-primary/80 bg-secondary/30 shrink-0 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </span>
            </button>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white truncate">{displayName}</h2>
                {user ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Synced
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground border border-border/40">
                    Guest
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || "Local Guest Profile"}
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Avatar: <span className="text-foreground font-medium">{currentAvatarInfo.name}</span> ({currentAvatarInfo.series})
              </p>
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAvatarModalOpen(true)}
              className="border-border/60 hover:bg-secondary text-xs h-9 px-4"
            >
              Change Avatar
            </Button>
          </div>
        </div>

        {/* Display Name Editor */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Display Name
            </label>
            {isEditingName ? (
              <form onSubmit={handleSaveUsername} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={30}
                    placeholder="Enter username"
                    autoFocus
                    className="h-9 text-sm bg-secondary/40 border-border"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-muted-foreground">
                    {nameInput.length}/30
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingName || !nameInput.trim()}
                    className="h-9 text-xs px-4"
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNameInput(displayName);
                      setIsEditingName(false);
                    }}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/30 max-w-md">
                <span className="text-sm font-medium text-white">{displayName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNameInput(displayName);
                    setIsEditingName(true);
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Account Status / Sync */}
          <div className="pt-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Account Status
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/30">
              <div>
                <p className="text-xs font-medium text-white">
                  {user ? "Cloud Account" : "Guest Mode"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {user
                    ? `Logged in with ${user.email}. Profile and history are synchronized.`
                    : "Profile is stored locally in this browser. Sign in to sync across devices."}
                </p>
              </div>
              {!user && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openAuth("signin")}
                  className="text-xs h-8 shrink-0"
                >
                  Sign In to Sync
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Viewing & Layout Settings */}
      <div className="rounded-3xl bg-card border border-border/40 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              Viewing &amp; Layout Settings
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose your preferred layout for streaming on mobile, desktop, or big-screen TVs.
            </p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-secondary border border-border/50 text-muted-foreground w-fit">
            Device Preference
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Standard Layout Option */}
          <button
            type="button"
            onClick={() => {
              setTvMode(false);
              showToast("Switched to Standard Layout");
            }}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative space-y-2.5 ${
              !tvMode
                ? "bg-primary/10 border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
                : "bg-secondary/30 border-border/50 hover:border-border hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    !tvMode
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Standard Mode</h3>
                  <span className="text-[10px] text-muted-foreground">
                    Best for PC &amp; Phones
                  </span>
                </div>
              </div>
              {!tvMode && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary text-white">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Balanced layout with the player on the left and a vertical episode list on the right.
            </p>
          </button>

          {/* TV Mode Option */}
          <button
            type="button"
            onClick={() => {
              setTvMode(true);
              showToast("TV Mode enabled! Cinema player + horizontal episode shelf active.");
            }}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative space-y-2.5 ${
              tvMode
                ? "bg-purple-500/15 border-purple-500 shadow-lg shadow-purple-500/15 ring-1 ring-purple-500"
                : "bg-secondary/30 border-border/50 hover:border-border hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tvMode
                      ? "bg-purple-500 text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    TV / Cinema Mode
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200">
                      10ft UI
                    </span>
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    Couch &amp; Big Screen Viewing
                  </span>
                </div>
              </div>
              {tvMode && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500 text-white">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Maximized cinema player, large horizontal episode carousel, and remote-friendly navigation.
            </p>
          </button>
        </div>
      </div>

      {/* Stats & Preferences Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* History */}
        <Link
          to="/history"
          className="p-5 rounded-2xl bg-card border border-border/40 hover:border-border transition-colors block select-none"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Episodes Watched</span>
            <History className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{history.length}</p>
          <span className="text-[11px] text-primary hover:underline mt-1 inline-block">
            View History &rarr;
          </span>
        </Link>

        {/* Watchlist */}
        <Link
          to="/watchlist"
          className="p-5 rounded-2xl bg-card border border-border/40 hover:border-border transition-colors block select-none"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Watchlist</span>
            <Heart className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{watchlist.length}</p>
          <span className="text-[11px] text-primary hover:underline mt-1 inline-block">
            View Watchlist &rarr;
          </span>
        </Link>

        {/* Title Display */}
        <div className="p-5 rounded-2xl bg-card border border-border/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Title Display</span>
            <TitleLanguageToggle size="sm" />
          </div>
          <p className="text-xs text-foreground mt-2 font-medium">English / Romaji</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Toggle subtitle &amp; series titles
          </span>
        </div>
      </div>

      {/* Log Out */}
      {user && (
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-red-400 hover:bg-destructive/10"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Log Out
          </Button>
        </div>
      )}

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={avatarUrl}
        onSelectAvatar={handleSelectAvatar}
      />

      {/* Auth Modal for Sign In */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab={authTab}
      />
    </div>
  );
}

export default ProfilePage;
