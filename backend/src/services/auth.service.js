import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  AUTH_SALT_ROUNDS,
  JWT_EXPIRES_IN,
  PASSWORD_MIN_LENGTH,
} from "../constants/auth.constants.js";
import { getSuperAdminEmail } from "../constants/users.constants.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRole(roleValue) {
  const raw = String(roleValue || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ");

  if (raw === "staff" || raw === "admin staff" || raw === "admin_staff") {
    return "staff";
  }
  if (raw === "candidate") {
    return "candidate";
  }
  if (raw === "admin") {
    return "admin";
  }
  return null;
}

function sanitizeAvatar(value) {
  const avatarUrl = String(value || "").trim();
  if (!avatarUrl) return "";
  // Demo-safe limit for data URLs / remote URLs
  if (avatarUrl.length > 300000) {
    throw new HttpError(400, "Avatar is too large");
  }
  return avatarUrl;
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    secret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl || "",
    activeStatus: user.activeStatus,
    createdAt: user.createdAt,
  };
}

export async function registerCandidate(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const avatarUrl = sanitizeAvatar(body.avatarUrl);

  if (!isValidEmail(email)) {
    throw new HttpError(400, "Invalid email");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(
      400,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, AUTH_SALT_ROUNDS);
  const user = await User.create({
    email,
    passwordHash,
    name,
    avatarUrl,
    role: "candidate",
  });

  const token = signToken(user);
  return { token, user: toPublicUser(user) };
}

export async function login(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    throw new HttpError(400, "Email and password required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  if (!user.activeStatus) {
    throw new HttpError(403, "Account is disabled");
  }

  if (user.role === "admin" && user.email !== getSuperAdminEmail()) {
    throw new HttpError(401, "Invalid email or password");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = signToken(user);
  return { token, user: toPublicUser(user) };
}

export function getMePayload(userDoc) {
  return { user: toPublicUser(userDoc) };
}

export async function listUsers(query) {
  const roleQuery = String(query.role || "").trim();
  const search = String(query.search || "").trim();

  const mongoQuery = {};

  if (roleQuery) {
    const normalizedRoles = roleQuery
      .split(",")
      .map((item) => normalizeRole(item))
      .filter(Boolean);

    if (normalizedRoles.length > 0) {
      mongoQuery.role = { $in: normalizedRoles };
    }
  }

  if (search) {
    mongoQuery.$or = [
      { email: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(mongoQuery)
    .sort({ createdAt: -1 })
    .select("email name role activeStatus avatarUrl createdAt");

  return { users: users.map((user) => toPublicUser(user)) };
}

/** Admin or staff may create only `staff` or `candidate` (never a second `admin`). */
export async function createUserByPrivileged(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const avatarUrl = sanitizeAvatar(body.avatarUrl);
  const role = normalizeRole(body.role);

  if (!role || role === "admin") {
    throw new HttpError(400, "Role must be admin staff or candidate");
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, "Invalid email");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(
      400,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }

  if (email === getSuperAdminEmail()) {
    throw new HttpError(400, "This email is reserved for the system admin");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, "Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, AUTH_SALT_ROUNDS);
  const user = await User.create({
    email,
    passwordHash,
    name,
    avatarUrl,
    role,
    activeStatus: true,
  });

  return { user: toPublicUser(user) };
}
