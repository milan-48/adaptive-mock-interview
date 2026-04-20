import * as authService from "../services/auth.service.js";
import logger from "../utils/logger.js";
import { HttpError } from "../utils/httpError.js";

export async function register(req, res) {
  try {
    const result = await authService.registerCandidate(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Registration failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Login failed", { message: err.message, stack: err.stack });
    return res.status(500).json({ error: "Login failed" });
  }
}

export function me(req, res) {
  return res.json(authService.getMePayload(req.user));
}

export function adminPing(_req, res) {
  res.json({ ok: true, message: "Admin access" });
}

export async function listUsers(req, res) {
  try {
    const result = await authService.listUsers(req.query);
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("List users failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not load users" });
  }
}

export async function createPrivilegedUser(req, res) {
  try {
    const result = await authService.createUserByPrivileged(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Create user failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not create user" });
  }
}

export async function updateUser(req, res) {
  try {
    const result = await authService.updateUserByPrivileged(
      req.params.userId,
      req.body,
      req.user,
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Update user failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not update user" });
  }
}
