import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchHistory, useWatchlist } from "@/hooks/useWatchHistory";
import { getAvatarByUrl, DEFAULT_AVATAR } from "@/lib/avatars";
import { AvatarPickerModal } from "@/components/profile/AvatarPickerModal";
import { TitleLanguageToggle } from "@/components/shared/TitleLanguageToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Pencil,
  Check,
  X,
  History,
  Heart,
  Cloud,
  CloudOff,
  LogOut,
  Palette,
  Info,
} from "lucide-react";

export function ProfilePage() {
  const { user, signOut, displayName, avatarUrl, updateProfile } = useAuth();
  const { history } = useWatchHistory();
  const { watchlist } = useWatchlist();

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      showToast("Username updated successfully!");
    } catch (err) {
      console.error("Failed to update username:", err);
      showToast("Failed to update username.");
    } finally {
      setSavingName(false);
    }
  };

  const handleSelectAvatar = async (newUrl: string) => {
    try {
      await updateProfile({ avatarUrl: newUrl });
      showToast("Avatar updated successfully!");
    } catch (err) {
      console.error("Failed to update avatar:", err);
      showToast("Failed to update avatar.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast("Signed out successfully.");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const openAuth = (tab: "signin" | "signup") => {
    setAuthTab(tab);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen pb-20 pt-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-primary/50 text-white shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Hero Profile Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-border/50 bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8 text-center md:text-left">
          {/* Avatar with Cute Edit Trigger */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-primary via-purple-400 to-pink-400 shadow-xl shadow-primary/20 ring-4 ring-background">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover rounded-full bg-card"
              />
            </div>

            {/* Change Avatar Overlay on hover */}
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
              title="Change Avatar"
            >
              <Palette className="w-5 h-5 mb-1 text-primary animate-bounce" />
              <span className="text-[10px] font-bold tracking-wide uppercase">Change</span>
            </button>

            {/* Floating Quick Edit Button (Always visible on mobile) */}
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              aria-label="Change Avatar"
            >
              <Sparkles className="w-4 h-4 fill-white" />
            </button>
          </div>

          {/* User Details & Edit Username */}
          <div className="flex-1 space-y-3 min-w-0">
            {/* Username Section */}
            {isEditingName ? (
              <form onSubmit={handleSaveUsername} className="flex flex-col sm:flex-row items-center gap-2 max-w-md">
                <div className="relative w-full">
                  <Input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={30}
                    placeholder="Enter your username"
                    autoFocus
                    className="h-10 text-base font-bold bg-secondary/80 border-primary focus-visible:ring-1 focus-visible:ring-primary pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground">
                    {nameInput.length}/30
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingName || !nameInput.trim()}
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg flex-1 sm:flex-none text-xs"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
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
                    className="rounded-lg text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate max-w-xs sm:max-w-md">
                  {displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(displayName);
                    setIsEditingName(true);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors cursor-pointer"
                  title="Edit Username"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Current Avatar Info */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/40 text-xs">
              <span className="text-primary font-bold">Avatar:</span>
              <span className="text-foreground font-medium">{currentAvatarInfo.name}</span>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-muted-foreground">{currentAvatarInfo.series}</span>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="ml-1 text-[11px] text-primary hover:underline font-semibold cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Email & Account Status */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-xs text-muted-foreground">
              {user ? (
                <>
                  <span className="text-foreground/90 font-medium">{user.email}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <Cloud className="w-3.5 h-3.5" /> Cloud Synced
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400/90 font-medium">
                  <CloudOff className="w-3.5 h-3.5" /> Guest Mode (Local Profile)
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAvatarModalOpen(true)}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-full text-xs font-semibold"
              >
                <Palette className="w-3.5 h-3.5 mr-1.5" />
                Select New Avatar
              </Button>

              {user ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="border-border/60 hover:bg-destructive/10 hover:text-red-400 text-muted-foreground rounded-full text-xs"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Log Out
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openAuth("signin")}
                  className="bg-primary hover:bg-primary/90 text-white rounded-full text-xs font-semibold shadow-md shadow-primary/25"
                >
                  <Cloud className="w-3.5 h-3.5 mr-1.5" />
                  Sign In to Cloud Sync
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Guest Mode Info Card (Only shown if unauthenticated) */}
      {!user && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-center sm:text-left">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Save Your Profile Across Devices</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You are currently browsing as a guest. Your avatar and username are saved locally on this browser. Create a free account or log in with Google to sync them anywhere.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openAuth("signin")}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              onClick={() => openAuth("signup")}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-full"
            >
              Create Account
            </Button>
          </div>
        </div>
      )}

      {/* Quick Anime Activity & Preferences Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Watch History Card */}
        <Link
          to="/history"
          className="group p-5 rounded-2xl bg-card/50 border border-border/40 hover:border-primary/60 hover:bg-card/80 transition-all duration-200 select-none shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Watch History</span>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-white">{history.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Episodes recorded</p>
          </div>
        </Link>

        {/* Watchlist Card */}
        <Link
          to="/watchlist"
          className="group p-5 rounded-2xl bg-card/50 border border-border/40 hover:border-primary/60 hover:bg-card/80 transition-all duration-200 select-none shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Watchlist Favorites</span>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-white">{watchlist.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Anime saved</p>
          </div>
        </Link>

        {/* Title Language Preference */}
        <div className="p-5 rounded-2xl bg-card/50 border border-border/40 flex flex-col justify-between shadow-sm sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Anime Title Display</span>
            <TitleLanguageToggle size="sm" />
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium text-foreground">English / Romaji</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Switch titles between Romanized Japanese &amp; English
            </p>
          </div>
        </div>
      </div>

      {/* Kawaii Policy Note */}
      <div className="p-4 rounded-2xl bg-card/30 border border-border/30 flex items-start gap-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Why can&apos;t I upload custom image files?</p>
          <p className="text-muted-foreground/80 leading-relaxed">
            To keep every profile on AniVerse sharp, lightweight, and cohesive, we provide a curated set of vector Studio Ghibli and anime chibi avatars. They load instantly with zero quality degradation and preserve our clean anime aesthetic.
          </p>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={avatarUrl}
        onSelectAvatar={handleSelectAvatar}
      />

      {/* Auth Modal for Sign In / Sign Up */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab={authTab}
      />
    </div>
  );
}

export default ProfilePage;
