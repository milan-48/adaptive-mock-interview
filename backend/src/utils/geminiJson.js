import { HttpError } from "./httpError.js";
import logger from "./logger.js";

/**
 * Primary model (also exported for callers). Model is not read from env —
 * on 429 / quota exhaustion we walk {@link GENERATE_CONTENT_MODEL_CHAIN}.
 */
export const GEMINI_MODEL_ID = "gemini-2.0-flash";

/**
 * Ordered fallbacks for the same Google Cloud project / API key.
 * Align with AI Studio “Rate limits by model”: when Gemini 2 Flash is saturated,
 * lighter Gemini models or Gemma often still have separate RPM/RPD headroom.
 * If an ID 404s for your key, remove it from this list.
 */
const GENERATE_CONTENT_MODEL_CHAIN = [
  GEMINI_MODEL_ID,
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  // Gemma on Gemini API (see https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

const MAX_GENERATION_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parses "Please retry in 50.59s" from Google error text; returns ms capped for serverless. */
function backoffMsFromGoogleMessage(message, httpStatus) {
  const msg = String(message || "");
  const m = msg.match(/retry in ([\d.]+)\s*s/i);
  if (m) {
    const sec = parseFloat(m[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(Math.ceil(sec * 1000), 65_000);
    }
  }
  if (httpStatus === 429) return 2800;
  return 0;
}

function shouldTryNextModelForQuota(payload, httpStatus) {
  if (httpStatus === 429) return true;
  const st = String(payload?.error?.status || "").toUpperCase();
  if (st === "RESOURCE_EXHAUSTED") return true;
  const msg = String(payload?.error?.message || "").toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource exhausted") ||
    msg.includes("too many requests")
  );
}

/** True when Google indicates quota / RPM limits. */
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

  if (!isLikelyQuotaIssue(payload, httpStatus)) {
    const hint =
      " Verify GEMINI_API_KEY in Vercel (Production), redeploy, no spaces/newlines. In Google Cloud Console: enable “Generative Language API” for the same project as the key.";
    return `${core}.${hint}`;
  }

  // Error text like "limit: 0" for free_tier_* means no free quota left for this model/project.
  const limitZero = /limit:\s*0/i.test(googleMsg);
  if (limitZero) {
    return `${core} — Free-tier metrics show limit 0 for this model: enable a billing account on the Google Cloud project that owns this API key (Console → Billing). Paid quotas apply after billing is linked. https://ai.google.dev/gemini-api/docs/rate-limits`;
  }

  return `${core} — For sustained traffic: enable billing on that Cloud project, or wait for free-tier resets. https://ai.google.dev/gemini-api/docs/rate-limits`;
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

  const bodyString = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
  });

  let lastRes = null;
  let lastPayload = null;
  let lastModelId = GENERATE_CONTENT_MODEL_CHAIN[0];

  modelLoop: for (let mi = 0; mi < GENERATE_CONTENT_MODEL_CHAIN.length; mi++) {
    const modelId = GENERATE_CONTENT_MODEL_CHAIN[mi];
    lastModelId = modelId;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelId,
    )}:generateContent?key=${encodeURIComponent(key)}`;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      const { res, payload } = await generateContentOnce(url, bodyString);
      lastRes = res;
      lastPayload = payload;

      if (res.ok) {
        const text =
          payload?.candidates?.[0]?.content?.parts
            ?.map((p) => p?.text || "")
            .join("\n")
            .trim() || "";
        const parsed = extractJsonObject(text);
        if (!parsed || typeof parsed !== "object") {
          throw new HttpError(502, "Gemini response was not valid JSON");
        }
        if (modelId !== GEMINI_MODEL_ID) {
          logger.info("Gemini generateContent ok (fallback model)", {
            modelId,
            primaryModel: GEMINI_MODEL_ID,
          });
        }
        return parsed;
      }

      const hasNextModel = mi < GENERATE_CONTENT_MODEL_CHAIN.length - 1;
      if (hasNextModel && shouldTryNextModelForQuota(payload, res.status)) {
        logger.warn(
          "Gemini quota/rate limit hit; trying next model without long backoff",
          {
            failedModel: modelId,
            nextModel: GENERATE_CONTENT_MODEL_CHAIN[mi + 1],
            httpStatus: res.status,
          },
        );
        continue modelLoop;
      }

      const googleMsg = String(payload?.error?.message || "");
      const waitMs = backoffMsFromGoogleMessage(googleMsg, res.status);

      if (attempt < MAX_GENERATION_ATTEMPTS && waitMs > 0) {
        logger.warn("Gemini generateContent failed; retrying after backoff", {
          modelId,
          attempt,
          httpStatus: res.status,
          waitMs,
        });
        await sleep(waitMs);
        continue;
      }

      break;
    }
  }

  logger.warn("Gemini generateContent failed", {
    modelId: lastModelId,
    modelsAttempted: GENERATE_CONTENT_MODEL_CHAIN,
    httpStatus: lastRes?.status,
    googleError: lastPayload?.error || lastPayload,
  });
  throw new HttpError(
    502,
    formatFailureMessage(lastPayload || {}, lastRes?.status || 0),
  );
}
