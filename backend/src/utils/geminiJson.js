import { HttpError } from "./httpError.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/** Comma-separated list, tried after primary when quota or overload hits. */
function geminiModelCandidates() {
  const primary = String(GEMINI_MODEL || "gemini-2.0-flash").trim();
  const extra = String(process.env.GEMINI_MODEL_FALLBACKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];
  const ordered = [primary, ...extra, ...defaults];
  return [...new Set(ordered)];
}

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

function shouldTryNextModel(payload, status) {
  if (status === 404) return true;
  return isQuotaOrOverload(payload, status);
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

  const models = geminiModelCandidates();
  let lastPayload = {};
  let lastStatus = 0;
  let lastMessage = "";

  for (const modelId of models) {
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
    lastPayload = payload;
    lastStatus = res.status;
    lastMessage =
      payload?.error?.message || `Gemini API error (${res.status})`;

    if (!res.ok) {
      if (
        shouldTryNextModel(payload, res.status) &&
        models.indexOf(modelId) < models.length - 1
      ) {
        continue;
      }
      if (isQuotaOrOverload(payload, res.status)) {
        throw new HttpError(
          502,
          "Gemini quota exceeded for all tried models. Enable billing on your Google AI project, wait for the free tier reset, or set GEMINI_MODEL / GEMINI_MODEL_FALLBACKS to a model your plan can use. See https://ai.google.dev/gemini-api/docs/rate-limits",
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

  throw new HttpError(502, lastPayload?.error?.message || String(lastMessage));
}
