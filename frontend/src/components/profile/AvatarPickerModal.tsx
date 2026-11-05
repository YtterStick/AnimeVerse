import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ANIME_AVATARS } from "@/lib/avatars";
import { Check, Sparkles, ShieldAlert, Heart } from "lucide-react";

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl: string;
  onSelectAvatar: (avatarUrl: string) => Promise<void> | void;
}

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  onSelectAvatar,
}: AvatarPickerModalProps) {
  const [selectedUrl, setSelectedUrl] = useState<string>(currentAvatarUrl);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [saving, setSaving] = useState(false);

  const categories = ["All", "Studio Ghibli", "Anime Chibi"];

  const filteredAvatars = ANIME_AVATARS.filter((avatar) => {
    if (activeCategory === "All") return true;
    return avatar.category === activeCategory;
  });

  const handleConfirm = async () => {
    try {
      setSaving(true);
      await onSelectAvatar(selectedUrl);
      onClose();
    } catch (err) {
      console.error("Failed to update avatar:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-border/40 bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Choose Your Anime Avatar
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Pick your favorite cute anime or Studio Ghibli character. Custom file uploads are disabled to preserve high-res cute anime aesthetics.
            </DialogDescription>
          </DialogHeader>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 mt-3 pt-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                  activeCategory === cat
                    ? "bg-primary text-white border-primary shadow-sm shadow-primary/25"
                    : "bg-secondary/60 text-muted-foreground border-border/30 hover:text-foreground hover:bg-secondary"
                }`}
              >
                {cat === "All" ? `All (${ANIME_AVATARS.length})` : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Avatar Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[52vh]">
          {/* Note Banner */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>Uploads disabled. Only curated kawaii anime and Ghibli avatars are permitted.</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredAvatars.map((avatar) => {
              const isSelected = selectedUrl === avatar.url;

              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedUrl(avatar.url)}
                  className={`group relative flex flex-col items-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer select-none ${
                    isSelected
                      ? "bg-primary/15 border-primary shadow-md shadow-primary/20 ring-2 ring-primary/40 scale-[1.02]"
                      : "bg-secondary/30 hover:bg-secondary/60 border-border/40 hover:border-border/80"
                  }`}
                >
                  {/* Selected checkmark indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md animate-in zoom-in-50 duration-150">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}

                  {/* Avatar Image */}
                  <div className="w-16 h-16 rounded-full overflow-hidden p-0.5 bg-background/50 border border-border/30 group-hover:scale-105 transition-transform duration-200 shadow-sm">
                    <img
                      src={avatar.url}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Character Info */}
                  <div className="mt-2 space-y-0.5 w-full">
                    <p className="text-xs font-bold text-white truncate group-hover:text-primary transition-colors">
                      {avatar.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {avatar.series}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/40 bg-card/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Heart className="w-3.5 h-3.5 text-primary/70 fill-primary/30" />
            <span className="hidden sm:inline">100% Vector Kawaii Art</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs px-5 rounded-full shadow-md shadow-primary/25"
            >
              {saving ? "Saving..." : "Save Avatar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default AvatarPickerModal;
