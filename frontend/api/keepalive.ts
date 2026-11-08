export const config = {
  runtime: "edge",
};

const DEFAULT_RENDER_HEALTH_URL = "https://animeverse-z6p4.onrender.com/api/health";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Origin: "https://anime-verse-ytter.vercel.app",
  Referer: "https://anime-verse-ytter.vercel.app/",
};

function getConfiguredApiBase(): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return (proc?.env?.VITE_API_URL || "").replace(/\/+$/, "");
}

async function pingRenderUntilAwake(
  targetUrl: string
): Promise<{ awake: boolean; status: number; attempts: number }> {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${targetUrl}?t=${Date.now()}&a=${attempt}`, {
        method: "GET",
        headers: BROWSER_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      lastStatus = res.status;
      if (res.ok) {
        return { awake: true, status: res.status, attempts: attempt };
      }
    } catch {
      lastStatus = 0;
    }

    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  return { awake: false, status: lastStatus, attempts: 5 };
}

/**
 * Vercel Edge Keep-Alive Relay for cron-job.org.
 * Render's proxy can ignore or return transient 503s to cron-job.org's bot User-Agent.
 * Pinging `/api/keepalive` on Vercel sends genuine browser-origin requests to Render,
 * retries transient 502/503 cold-start responses in the background via `waitUntil`,
 * and always returns a tiny <100B 200 OK to cron-job.org within 3.5s.
 */
export default async function handler(
  _req: Request,
  ctx?: { waitUntil?: (promise: Promise<unknown>) => void }
): Promise<Response> {
  const configuredBase = getConfiguredApiBase();
  const targetUrl = configuredBase ? `${configuredBase}/api/health` : DEFAULT_RENDER_HEALTH_URL;

  const wakePromise = pingRenderUntilAwake(targetUrl);

  const quickCheck = await Promise.race([
    wakePromise,
    new Promise<{ awake: boolean; status: number; attempts: number; background: true }>((resolve) =>
      setTimeout(
        () => resolve({ awake: false, status: 202, attempts: 1, background: true }),
        3500
      )
    ),
  ]);

  if ("background" in quickCheck && quickCheck.background && ctx?.waitUntil) {
    ctx.waitUntil(wakePromise);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      render: quickCheck.awake ? "awake" : "waking",
      status: quickCheck.status,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
