const raw = String(process.env.NEXT_PUBLIC_API_URL || "").trim();

/**
 * In production on Vercel, prefer same-origin calls to `/v1/...` so rewrites apply and CORS is avoided.
 * In local dev, default to the Express server on 3001.
 */
export const API_URL = raw || (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");

const TOKEN_KEY = "ami_auth_token";
const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}
