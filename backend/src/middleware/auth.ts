import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    [key: string]: any;
  };
  token?: string;
}

// Extract Bearer token from authorization header
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
}

// Middleware to require authentication
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal authentication error" });
  }
}

// Middleware that optionally resolves user but does not block if unauthenticated
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  
  if (!token) {
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      req.user = user;
      req.token = token;
    }
  } catch (error) {
    console.error("Optional auth middleware error:", error);
  }
  
  next();
}
