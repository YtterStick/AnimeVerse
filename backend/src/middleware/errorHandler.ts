import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("❌ Error caught by global handler:", err?.message || err);

  // If an external upstream API returned 429 or 502, never proxy that directly as our own client status
  const rawStatus = err.status || err.response?.status;
  const status =
    rawStatus === 429
      ? 503
      : typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600
      ? rawStatus
      : 500;

  const message =
    rawStatus === 429
      ? "Upstream service is temporarily busy. Please refresh in a moment."
      : err.message || "An unexpected error occurred on the server";

  res.status(status).json({
    status,
    message,
    // Only return stack trace in non-production
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
}

export default errorHandler;
