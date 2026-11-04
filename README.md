# 🎬 AnimeVerse — Full-Featured Anime Streaming Platform

AnimeVerse is a modern, dark-themed anime streaming web application inspired by Crunchyroll and Netflix. Built with a decoupled architecture featuring a **React 19 + Vite frontend** and a high-performance **Node.js/Express proxy backend**, AnimeVerse delivers accurate anime resolution, crystal-clear 1080p HLS playback, and complete **English SUB and English DUB** streaming servers.

---

## ✨ Features

- **🎯 Accurate Title & Season Resolution:** Replaces blind title searches with multi-factor scoring (Romaji title, English title, synonyms, season number, type, and release year) backed by MALSync to eliminate wrong-season or movie mismatches.
- **🎧 Complete English SUB & DUB Support:**
  - **SUB (Eng):** Original Japanese audio with auto-activated English WEBVTT subtitles.
  - **DUB (Eng):** English dubbed audio stream with multi-audio HLS track pinning.
  - One-click **SUB / DUB** toggles directly on the player control bar.
- **⚡ Resilient Streaming Reverse Proxy:**
  - Robust backend proxy that handles rotating CDN upstream headers (`Referer` & `Origin`) to prevent 403 Forbidden stalls.
  - Native browser segment caching (`Cache-Control: public, max-age=86400, immutable`) for smooth buffering without stutters.
  - HTTP Range (`206 Partial Content`) seeking for MP4 and HLS streams.
- **🛡️ High-Availability Metadata (Jikan + AniList Failover):**
  - MyAnimeList metadata via Jikan v4 with an automatic in-memory fallback to AniList GraphQL to protect against rate limits and upstream outages.
- **📺 Modern Vidstack Player:**
  - Powered by `@vidstack/react` with custom shortcuts, quality selection, subtitle track picker, and eager preloading.
- **🔐 Hybrid Authentication & Sync (Supabase):**
  - **Guest Mode:** Search, browse, and watch any episode without registration.
  - **Authenticated Mode:** Log in with Email or Google OAuth to sync Watch History, resume playback ("Continue Watching"), and manage your Watchlist across devices.

---

## 🛠️ Tech Stack

| Component | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Vidstack Player, Lucide React, React Router |
| **Backend** | Node.js, Express, TypeScript, Axios, Node-Cache, `@consumet/extensions` |
| **Database & Auth** | Supabase (PostgreSQL with Row Level Security) |
| **Metadata Sources** | Jikan API v4 (MAL) with AniList GraphQL Fallback |
| **Hosting (Recommended)** | **Vercel** (Frontend) + **Render** (Backend Web Service) |

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js (v18 or newer)
- npm or pnpm
- A free [Supabase](https://supabase.com) project

### 1. Database Setup

1. Create a new project in your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** tab and execute the SQL script in `supabase/schema.sql`.
3. Under **Authentication → Providers**, enable **Email** and optionally **Google OAuth**.

### 2. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   npm install
   ```
2. Create a `.env` file inside `backend/`:
   ```env
   PORT=3001
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-supabase-service-role-key
   ```
3. Run the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will start at `http://localhost:3001`.*

### 3. Frontend Setup

1. In a separate terminal, navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```
2. Create a `.env.local` file inside `frontend/`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_API_URL=http://localhost:3001
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser.*

---

## 🌐 Production Deployment Guide

Because the backend operates a persistent streaming reverse proxy (handling long-running HLS chunk streams, binary pipes, and memory caching), it requires a dedicated container environment like **Render** rather than short-lived serverless functions.

### Step 1: Deploy Backend to Render

1. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New + → Web Service**.
2. Connect your GitHub repository (`AnimeVerse`).
3. Set the configuration:
   - **Name:** `animeverse-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Add the following **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `PORT` | `10000` | Render standard port |
   | `SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase Project URL |
   | `SUPABASE_SERVICE_KEY` | `your-service-key` | Supabase Service Role Key |
5. Click **Create Web Service** and copy your assigned service URL (e.g., `https://animeverse-backend.onrender.com`).

---

### Step 2: Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New… → Project**.
2. Import your GitHub repository (`AnimeVerse`).
3. Configure the project:
   - **Root Directory:** Select `frontend`
   - **Framework Preset:** `Vite` (automatically detected)
4. Add the following **Environment Variables**:
   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://animeverse-backend.onrender.com` *(from Step 1)* |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `your-supabase-anon-key` |
5. Click **Deploy**.

Vercel will build and serve your static React application on its global Edge network, routing all video stream requests directly to your Render backend via the included `vercel.json` SPA configuration.

---

## 📁 Project Structure

```
AnimeVerse/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variables & Supabase client
│   │   ├── middleware/      # Auth, rate limiting & error handlers
│   │   ├── routes/          # /api/anime, /api/stream, /api/history, /api/watchlist
│   │   ├── services/        # Stream aggregation (KAA & AnimeHeaven), Jikan & AniList fallback
│   │   └── server.ts        # Express application entry & CORS policy
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/              # Favicon and SVGs
│   ├── src/
│   │   ├── components/      # Vidstack VideoPlayer, ServerSelector, Layout, Modals
│   │   ├── contexts/        # Auth context provider
│   │   ├── hooks/           # useAnime, useWatchHistory, useDebounce
│   │   ├── lib/             # API client, Supabase config, utilities
│   │   └── pages/           # Home, AnimeDetail, Watch, Watchlist, Search
│   ├── vercel.json          # SPA rewrite rules for Vercel
│   ├── package.json
│   └── vite.config.ts
│
├── supabase/
│   └── schema.sql           # Database schema & RLS security policies
└── README.md
```

---

## 📄 License

This project is created for educational and personal portfolio purposes. All anime media content and streaming sources belong to their respective copyright holders.
