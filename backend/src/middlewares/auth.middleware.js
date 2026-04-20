import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

export function requireAuth() {
  return async (req, res, next) => {
    const token = getBearerToken(req);
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(token, secret);
      const user = await User.findById(payload.sub).select("-passwordHash");
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!user.activeStatus) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.user = user;
      return next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
