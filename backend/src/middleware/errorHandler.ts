import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("❌ Error caught by global handler:", err);

  const status = err.status || 500;
  const message = err.message || "An unexpected error occurred on the server";

  res.status(status).json({
    status,
    message,
    // Only return stack trace in non-production
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
}

export default errorHandler;
