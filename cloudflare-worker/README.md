# AniVerse Cloudflare Streaming Worker

This Cloudflare Worker handles 100% of AniVerse video streams, MP4 files, HLS playlists (`.m3u8`), and subtitle tracks (`.vtt`) with **UNLIMITED free bandwidth**.

---

### Step 1: Create the Worker on Cloudflare (Free)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and sign in (or sign up for free).
2. In the left navigation, click **Compute (Workers) > Workers & Pages**.
3. Click the blue **Create application** (or **Create Worker**) button.
4. Give it a name like `aniverse-stream` and click **Deploy**.

---

### Step 2: Paste the Worker Code
1. On the Worker summary page, click **Edit code** in the top right.
2. Delete whatever sample code is in `worker.js`.
3. Copy all code from [`worker.js`](./worker.js) and paste it into the editor.
4. Click **Deploy** in the top right.

---

### Step 3: Copy Your Worker URL
Cloudflare gives you a live public URL (e.g. `https://aniverse-stream.<your-subdomain>.workers.dev`).

Send that URL here or add it to your Vercel Environment Variables:
* Key: `VITE_STREAM_PROXY_URL`
* Value: `https://aniverse-stream.<your-subdomain>.workers.dev`

Once added, **0 bytes of video bandwidth** will ever touch Render!
