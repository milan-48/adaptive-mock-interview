import { HttpError } from "./httpError.js";
import logger from "./logger.js";

/** Fixed model for generateContent (no fallbacks, env overrides ignored). */
export const GEMINI_MODEL_ID = "gemini-2.0-flash";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when Google indicates quota / RPM limits (not every 403/400). */
function isLikelyQuotaIssue(payload, httpStatus) {
  const st = String(payload?.error?.status || "").toUpperCase();
  const msg = String(payload?.error?.message || "").toLowerCase();
  if (httpStatus === 429) return true;
  if (st === "RESOURCE_EXHAUSTED") return true;
  if (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource exhausted") ||
    msg.includes("too many requests")
  ) {
    return true;
  }
  return false;
}

function formatFailureMessage(payload, httpStatus) {
  const googleMsg = String(payload?.error?.message || "").trim();
  const core =
    googleMsg || `Gemini API returned HTTP ${httpStatus} (no message body)`;

  if (isLikelyQuotaIssue(payload, httpStatus)) {
    return `${core} — For sustained use: attach billing to the Google Cloud project linked to your API key (Google AI Studio → project → Billing), or wait for free-tier daily/monthly resets. https://ai.google.dev/gemini-api/docs/rate-limits`;
  }

  const hint =
    " Verify GEMINI_API_KEY in Vercel (Production), redeploy, no spaces/newlines. In Google Cloud Console: enable “Generative Language API” for the same project as the key; keys from AI Studio must stay tied to that project.";

  return `${core}.${hint}`;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsedFence = safeJsonParse(fenced[1].trim());
    if (parsedFence) return parsedFence;
  }

  const direct = safeJsonParse(text);
  if (direct) return direct;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const sliced = text.slice(first, last + 1);
    return safeJsonParse(sliced);
  }
  return null;
}

async function generateContentOnce(url, bodyString) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyString,
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload };
}

export async function callGeminiForJson(promptText) {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new HttpError(503, "GEMINI_API_KEY is not configured");
  }

  const modelId = GEMINI_MODEL_ID;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId,
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const bodyString = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
  });

  let { res, payload } = await generateContentOnce(url, bodyString);

  // One retry helps transient 429 / overload bursts on free tier.
  if (!res.ok && res.status === 429) {
    logger.warn("Gemini returned 429; retrying once after delay", {
      modelId,
    });
    await sleep(2800);
    ({ res, payload } = await generateContentOnce(url, bodyString));
  }

  if (!res.ok) {
    logger.warn("Gemini generateContent failed", {
      modelId,
      httpStatus: res.status,
      googleError: payload?.error || payload,
    });
    throw new HttpError(502, formatFailureMessage(payload, res.status));
  }

  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("\n")
      .trim() || "";
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== "object") {
    throw new HttpError(502, "Gemini response was not valid JSON");
  }
  return parsed;
}
