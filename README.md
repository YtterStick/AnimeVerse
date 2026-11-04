# AniVerse — Anime Streaming Web Application

AniVerse is a premium, dark-themed dashboard (similar to Netflix or Crunchyroll) for anime enthusiasts. Users can discover trending anime, view details, search the catalog, and watch episodes. 

## Key Features

1. **Discovery & Details:** Home dashboard with featured anime carousel, categories like Top Airing, Popular, and Recent, and detailed pages listing genres, description, and episodes.
2. **HLS Streaming Player:** Robust video streaming player integrated with `@vidstack/react` and `hls.js` supporting HLS/M3U8.
3. **Hybrid Authentication:** 
   - **Guest Access:** Search, browse, and watch anime without registering.
   - **Authenticated Access (Supabase Auth):** Log in to sync Watch History, resume progress ("Continue Watching" banner), and manage a private Watchlist.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui components, React Router v7, Lucide React, and Vidstack player.
- **Backend:** Node.js, Express, TypeScript, Node-Cache (for Jikan API responses), and Supabase-js.
- **Database / Auth:** Supabase (PostgreSQL with RLS policy security).
- **Metadata API:** Jikan API v4 (MyAnimeList community API).

---

## Getting Started

### 1. Database Setup
Register on [Supabase](https://supabase.com), create a project, and execute the SQL script located in `supabase/schema.sql` inside the Supabase SQL editor. Enable Email/Password and Google OAuth providers under Authentication settings.

### 2. Backend Config & Run
Create `backend/.env` with your Supabase credentials:
```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

Run backend in development mode:
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Config & Run
Create `frontend/.env.local` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:3001
```

Run frontend in development mode:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`.
