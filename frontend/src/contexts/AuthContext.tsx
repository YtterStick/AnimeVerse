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
import { DEFAULT_AVATAR } from "@/lib/avatars";

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
  signUpWithEmail: (email: string, password: string) => Promise<void>;
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
      return {
        username: parsed.username || "Anime Explorer",
        avatarUrl: parsed.avatarUrl || DEFAULT_AVATAR,
      };
    }
  } catch {
    // Ignore JSON errors
  }
  return {
    username: "Anime Explorer",
    avatarUrl: DEFAULT_AVATAR,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestProfile, setGuestProfile] = useState<ProfileData>(getStoredGuestProfile);

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
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
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
      // 1. Update guest/local state
      setGuestProfile((prev) => {
        const next = {
          username: username !== undefined ? username.trim() : prev.username,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : prev.avatarUrl,
        };
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore localStorage errors
        }
        return next;
      });

      // 2. If logged in with Supabase, sync to user_metadata
      if (user && isSupabaseConfigured) {
        const payload: Record<string, any> = {};
        if (username !== undefined) payload.full_name = username.trim();
        if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;

        const { data: updated, error } = await supabase.auth.updateUser({
          data: payload,
        });

        if (error) throw error;
        if (updated?.user) {
          setUser(updated.user);
        }
      }
    },
    [user]
  );

  // Compute resolved display name and avatar URL
  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    guestProfile.username ||
    "Anime Explorer";

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    guestProfile.avatarUrl ||
    DEFAULT_AVATAR;

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
