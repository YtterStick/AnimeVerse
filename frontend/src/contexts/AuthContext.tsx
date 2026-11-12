import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_AVATAR,
  generateRandomAnimeProfile,
  isExternalOAuthAvatar,
} from "@/lib/avatars";

export interface ProfileData {
  username: string;
  avatarUrl: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  displayName: string;
  avatarUrl: string;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { username?: string; avatarUrl?: string }) => Promise<void>;
}

const GUEST_STORAGE_KEY = "aniverse_guest_profile";

function getStoredGuestProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.username && parsed.avatarUrl) {
        return {
          username: parsed.username,
          avatarUrl: parsed.avatarUrl,
        };
      }
    }
  } catch {
    // Ignore JSON errors
  }
  const generated = generateRandomAnimeProfile();
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(generated));
  } catch {
    // Ignore localStorage errors
  }
  return generated;
}

function isRawOAuthOrDefaultUsername(
  raw: string | null | undefined,
  currentUser: User
): boolean {
  const trimmed = (raw || "").trim();
  if (!trimmed) return true;
  if (/^Otaku #[A-F0-9]+$/i.test(trimmed)) return true;

  const email = (currentUser.email || "").trim().toLowerCase();
  const emailLocal = email.split("@")[0] || "";
  const lower = trimmed.toLowerCase();
  if (email && (lower === email || lower === emailLocal)) return true;

  if (!currentUser.user_metadata?.aniverse_profile_initialized) {
    const oauthCandidates = [
      currentUser.user_metadata?.full_name,
      currentUser.user_metadata?.name,
      currentUser.identities?.[0]?.identity_data?.full_name,
      currentUser.identities?.[0]?.identity_data?.name,
    ];
    if (
      oauthCandidates.some(
        (c) => typeof c === "string" && c.trim().toLowerCase() === lower
      )
    ) {
      return true;
    }
  }
  return false;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestProfile, setGuestProfile] = useState<ProfileData>(getStoredGuestProfile);
  const [cloudProfile, setCloudProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load account profile from public.profiles (cross-device source of truth)
  // and auto-assign a random anime profile if only Gmail/default info is present.
  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCloudProfile(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const generated = generateRandomAnimeProfile(user.id);

        const { data: dbRow, error: fetchError } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const metaUsername =
          typeof user.user_metadata?.aniverse_username === "string"
            ? user.user_metadata.aniverse_username.trim()
            : "";
        const metaAvatar =
          typeof user.user_metadata?.aniverse_avatar_url === "string"
            ? user.user_metadata.aniverse_avatar_url.trim()
            : "";

        // If the DB lookup itself failed transiently, keep metadata/generated fallback in UI without overwriting DB
        if (fetchError) {
          setCloudProfile({
            username: metaUsername || generated.username,
            avatarUrl: !isExternalOAuthAvatar(metaAvatar) ? metaAvatar : generated.avatarUrl,
          });
          return;
        }

        const resolvedUsername = !isRawOAuthOrDefaultUsername(dbRow?.username, user)
          ? String(dbRow?.username).trim()
          : metaUsername || generated.username;

        const resolvedAvatar = !isExternalOAuthAvatar(dbRow?.avatar_url)
          ? String(dbRow?.avatar_url).trim()
          : !isExternalOAuthAvatar(metaAvatar)
            ? metaAvatar
            : generated.avatarUrl;

        const resolvedProfile: ProfileData = {
          username: resolvedUsername,
          avatarUrl: resolvedAvatar,
        };
        setCloudProfile(resolvedProfile);

        const needsDbSync =
          !dbRow ||
          dbRow.username !== resolvedUsername ||
          dbRow.avatar_url !== resolvedAvatar;

        if (needsDbSync) {
          await supabase.from("profiles").upsert(
            {
              id: user.id,
              username: resolvedUsername,
              avatar_url: resolvedAvatar,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        }

        const needsMetaSync =
          !user.user_metadata?.aniverse_profile_initialized ||
          metaUsername !== resolvedUsername ||
          metaAvatar !== resolvedAvatar;

        if (needsMetaSync && !cancelled) {
          const { data: updated } = await supabase.auth.updateUser({
            data: {
              aniverse_username: resolvedUsername,
              aniverse_avatar_url: resolvedAvatar,
              aniverse_profile_initialized: true,
            },
          });
          if (!cancelled && updated?.user) {
            setUser(updated.user);
          }
        }
      } catch {
        // Keep metadata/generated fallback cleanly if profile sync fails transiently
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(
    async ({ username, avatarUrl }: { username?: string; avatarUrl?: string }) => {
      const trimmedName = username !== undefined ? username.trim() : undefined;

      // 1. Logged-in account: save directly to Supabase `profiles` table + auth metadata
      // so changes persist across all devices and Google logins never overwrite them.
      if (user && isSupabaseConfigured) {
        const fallback = generateRandomAnimeProfile(user.id);
        const nextUsername =
          trimmedName !== undefined
            ? trimmedName
            : cloudProfile?.username ||
              user.user_metadata?.aniverse_username ||
              fallback.username;
        const nextAvatarUrl =
          avatarUrl !== undefined
            ? avatarUrl
            : cloudProfile?.avatarUrl ||
              (!isExternalOAuthAvatar(user.user_metadata?.aniverse_avatar_url)
                ? user.user_metadata?.aniverse_avatar_url
                : fallback.avatarUrl);

        const { error: dbError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            username: nextUsername,
            avatar_url: nextAvatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (dbError) throw dbError;

        setCloudProfile({ username: nextUsername, avatarUrl: nextAvatarUrl });

        const { data: updated, error: authError } = await supabase.auth.updateUser({
          data: {
            aniverse_username: nextUsername,
            aniverse_avatar_url: nextAvatarUrl,
            aniverse_profile_initialized: true,
          },
        });
        if (!authError && updated?.user) {
          setUser(updated.user);
        }
        return;
      }

      // 2. Guest mode: persist locally in browser storage
      setGuestProfile((prev) => {
        const next = {
          username: trimmedName !== undefined ? trimmedName : prev.username,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : prev.avatarUrl,
        };
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore localStorage errors
        }
        return next;
      });
    },
    [user, cloudProfile]
  );

  // Compute resolved display name and avatar URL (never expose Gmail name/photo)
  const fallbackUserProfile = user ? generateRandomAnimeProfile(user.id) : null;

  const displayName = user
    ? cloudProfile?.username ||
      user.user_metadata?.aniverse_username ||
      fallbackUserProfile?.username ||
      "Anime Explorer"
    : guestProfile.username || "Anime Explorer";

  const avatarUrl = user
    ? cloudProfile?.avatarUrl ||
      (!isExternalOAuthAvatar(user.user_metadata?.aniverse_avatar_url)
        ? user.user_metadata?.aniverse_avatar_url
        : fallbackUserProfile?.avatarUrl) ||
      DEFAULT_AVATAR
    : guestProfile.avatarUrl || DEFAULT_AVATAR;

  const isAdmin = Boolean(
    user &&
      (user.email?.toLowerCase().trim() === "andreidilag12@gmail.com" ||
        user.app_metadata?.role === "admin")
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        isAdmin,
        displayName,
        avatarUrl,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
