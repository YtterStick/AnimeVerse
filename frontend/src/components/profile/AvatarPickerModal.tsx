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
import { Check } from "lucide-react";

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
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-border/40">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-white tracking-tight">
              Choose Avatar
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an anime avatar for your profile. Uploads are disabled.
            </DialogDescription>
          </DialogHeader>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 mt-3 pt-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                  activeCategory === cat
                    ? "bg-primary text-white border-primary"
                    : "bg-secondary/40 text-muted-foreground border-border/30 hover:text-foreground hover:bg-secondary"
                }`}
              >
                {cat === "All" ? `All (${ANIME_AVATARS.length})` : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Avatar Grid */}
        <div className="flex-1 overflow-y-auto p-5 max-h-[50vh]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredAvatars.map((avatar) => {
              const isSelected = selectedUrl === avatar.url;

              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedUrl(avatar.url)}
                  className={`relative flex flex-col items-center p-3 rounded-xl border text-center transition-colors cursor-pointer select-none ${
                    isSelected
                      ? "bg-secondary/60 border-primary ring-1 ring-primary"
                      : "bg-secondary/20 hover:bg-secondary/50 border-border/40 hover:border-border/80"
                  }`}
                >
                  {/* Selected checkmark badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}

                  {/* Avatar Circle */}
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-background border border-border/40">
                    <img
                      src={avatar.url}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Character Info */}
                  <div className="mt-2 space-y-0.5 w-full">
                    <p className="text-xs font-semibold text-white truncate">
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
        <div className="p-4 border-t border-border/40 bg-card flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filteredAvatars.length} avatars available
          </span>

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
              className="text-xs px-4"
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
