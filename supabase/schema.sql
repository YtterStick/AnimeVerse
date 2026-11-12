-- ============================================
-- AniVerse Database Schema for Supabase
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watch History
CREATE TABLE public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    anime_id INTEGER NOT NULL, -- Jikan/MAL anime ID
    anime_title TEXT NOT NULL,
    anime_image TEXT,
    episode_number INTEGER NOT NULL,
    episode_title TEXT,
    progress_seconds INTEGER DEFAULT 0, -- Playback position
    duration_seconds INTEGER DEFAULT 0, -- Total episode duration
    watched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (
        user_id,
        anime_id,
        episode_number
    )
);

-- Watchlist / Favorites
CREATE TABLE public.watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    anime_id INTEGER NOT NULL,
    anime_title TEXT NOT NULL,
    anime_image TEXT,
    anime_type TEXT, -- TV, Movie, OVA, etc.
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, anime_id)
);

-- Indexes for performance
CREATE INDEX idx_watch_history_user ON public.watch_history (user_id, watched_at DESC);

CREATE INDEX idx_watchlists_user ON public.watchlists (user_id, added_at DESC);

-- ============================================
-- Row Level Security Policies
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update only their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR
SELECT USING (auth.uid () = id);

CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE USING (auth.uid () = id);

CREATE POLICY "Users can insert own profile" ON public.profiles FOR
INSERT
WITH
    CHECK (auth.uid () = id);

-- Watch History: users can CRUD only their own history
CREATE POLICY "Users can view own history" ON public.watch_history FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can insert own history" ON public.watch_history FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can update own history" ON public.watch_history FOR
UPDATE USING (auth.uid () = user_id);

CREATE POLICY "Users can delete own history" ON public.watch_history FOR DELETE USING (auth.uid () = user_id);

-- Watchlist: users can CRUD only their own list
CREATE POLICY "Users can view own watchlist" ON public.watchlists FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can insert to own watchlist" ON public.watchlists FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can delete from own watchlist" ON public.watchlists FOR DELETE USING (auth.uid () = user_id);

-- ============================================
-- Auto-create profile on signup (trigger)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    'Otaku #' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6)),
    '/avatars/totoro.svg'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();