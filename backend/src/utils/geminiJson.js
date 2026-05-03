import { HttpError } from "./httpError.js";

/** Fixed model for generateContent (no fallbacks, env overrides ignored). */
export const GEMINI_MODEL_ID = "gemini-2.0-flash";

function isQuotaOrOverload(payload, status) {
  const msg = String(payload?.error?.message || "").toLowerCase();
  const st = String(payload?.error?.status || "").toUpperCase();
  if (status === 429) return true;
  if (st === "RESOURCE_EXHAUSTED") return true;
  if (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource exhausted")
  ) {
    return true;
  }
  return false;
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

export async function callGeminiForJson(promptText) {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new HttpError(503, "GEMINI_API_KEY is not configured");
  }

  const modelId = GEMINI_MODEL_ID;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId,
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await res.json().catch(() => ({}));
  const lastMessage =
    payload?.error?.message || `Gemini API error (${res.status})`;

  if (!res.ok) {
    if (isQuotaOrOverload(payload, res.status)) {
      throw new HttpError(
        502,
        `Gemini quota or rate limit on ${modelId}. Enable billing or wait for reset. See https://ai.google.dev/gemini-api/docs/rate-limits`,
      );
    }
    throw new HttpError(502, lastMessage);
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
