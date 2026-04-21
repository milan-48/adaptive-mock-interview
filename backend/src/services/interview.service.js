import { randomInt } from "node:crypto";
import { Interview } from "../models/Interview.js";
import { InterviewPromptTemplate } from "../models/InterviewPromptTemplate.js";
import { User } from "../models/User.js";
import {
  DEFAULT_INTERVIEW_DIFFICULTY,
  DEFAULT_INTERVIEW_DURATION_MIN,
  INTERVIEW_DIFFICULTY_LEVELS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPE_PRESETS,
  MAX_INTERVIEW_DURATION_MIN,
  MIN_INTERVIEW_DURATION_MIN,
} from "../constants/interview.constants.js";
import {
  getInterviewPromptTemplate,
  normalizeInterviewType as normalizePromptInterviewType,
} from "../constants/interviewPrompt.constants.js";
import {
  buildGeminiPromptText,
  buildInitialPromptPayload,
  buildNextTurnPromptPayload,
} from "./interviewPromptBuilder.service.js";
import { HttpError } from "../utils/httpError.js";

const RESUME_MAX_LEN = 300000;
const RESUME_SUMMARY_MAX_LEN = 6000;
const RUNNING_SUMMARY_MAX_LEN = 12000;
const ASKED_TOPICS_MAX = 100;
const CONTEXT_ITEMS_MAX = 40;
const CONTEXT_ITEM_MAX_LEN = 120;
const QUESTION_MAX_LEN = 3000;
const ANSWER_MAX_LEN = 12000;
const POLICY_REASON_MAX_LEN = 2000;
const INTEGRITY_EVENTS_MAX = 120;

const ALLOCATE_ROOM_MAX_ATTEMPTS = 128;
const ABUSE_SUSPEND_THRESHOLD = 2;
const CHEATING_SUSPEND_THRESHOLD = 2;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ELEVEN_TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_flash_v2_5";
const ELEVEN_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

const FALLBACK_INTERVIEWER_PROFILES = [
  {
    id: "fallback_female",
    name: "Ava",
    gender: "female",
    avatarStyle: "female",
    voiceId: process.env.ELEVENLABS_VOICE_ID_FEMALE || "",
  },
  {
    id: "fallback_male",
    name: "Liam",
    gender: "male",
    avatarStyle: "male",
    voiceId: process.env.ELEVENLABS_VOICE_ID_MALE || "",
  },
];

function sanitizeResume(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (s.length > RESUME_MAX_LEN) {
    throw new HttpError(400, "Resume payload is too large");
  }
  return s;
}

function sanitizeText(value, maxLen) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.slice(0, maxLen);
}

function sanitizeStringArray(
  value,
  maxItems = CONTEXT_ITEMS_MAX,
  maxLen = CONTEXT_ITEM_MAX_LEN,
) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const item = sanitizeText(raw, maxLen);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeDifficulty(value) {
  const difficulty = String(value || DEFAULT_INTERVIEW_DIFFICULTY)
    .trim()
    .toLowerCase();
  if (!INTERVIEW_DIFFICULTY_LEVELS.includes(difficulty)) {
    return DEFAULT_INTERVIEW_DIFFICULTY;
  }
  return difficulty;
}

function normalizeInterviewType(value) {
  return normalizePromptInterviewType(value);
}

function parseYearsOfExperience(value) {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new HttpError(400, "Invalid years of experience");
  }
  return n;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonObject(raw) {
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

function randomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[randomInt(0, items.length)];
}

function normalizeInterviewerGender(value) {
  const g = String(value || "")
    .trim()
    .toLowerCase();
  if (g === "female" || g === "male" || g === "neutral") return g;
  return "neutral";
}

function normalizeInterviewerProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const voiceId = sanitizeText(raw.voiceId, 120);
  const id = sanitizeText(raw.id || voiceId, 120);
  const name = sanitizeText(raw.name, 120) || "AI Interviewer";
  const gender = normalizeInterviewerGender(raw.gender);
  const avatarStyle =
    sanitizeText(raw.avatarStyle, 30) ||
    (gender === "female" ? "female" : "male");
  if (!id && !name) return null;
  return {
    id: id || `${avatarStyle}_${name.toLowerCase().replace(/\s+/g, "_")}`,
    name,
    gender,
    avatarStyle,
    voiceId,
  };
}

function fallbackInterviewerProfile() {
  const normalized = FALLBACK_INTERVIEWER_PROFILES.map((p) =>
    normalizeInterviewerProfile(p),
  ).filter(Boolean);
  const picked = randomItem(normalized) || normalizeInterviewerProfile({
    id: "fallback_ai",
    name: "AI Interviewer",
    gender: "neutral",
    avatarStyle: "male",
    voiceId: "",
  });
  return picked;
}

async function fetchRandomInterviewerProfileFromElevenLabs() {
  const apiKey = String(process.env.ELEVENLABS_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => ({}));
    const voices = Array.isArray(payload?.voices) ? payload.voices : [];
    const mapped = voices
      .map((v) =>
        normalizeInterviewerProfile({
          id: v.voice_id,
          voiceId: v.voice_id,
          name: v.name,
          gender: v?.labels?.gender,
          avatarStyle: v?.labels?.gender,
        }),
      )
      .filter((v) => v && v.voiceId);
    return randomItem(mapped);
  } catch {
    return null;
  }
}

async function resolveInterviewerProfileForInterview(doc) {
  const runtime = doc.runtimeState || {};
  const existing = normalizeInterviewerProfile(runtime.interviewer);
  if (existing?.voiceId) {
    runtime.interviewer = existing;
    doc.runtimeState = runtime;
    return existing;
  }

  const fromApi = await fetchRandomInterviewerProfileFromElevenLabs();
  const picked = fromApi || existing || fallbackInterviewerProfile();
  runtime.interviewer = picked;
  doc.runtimeState = runtime;
  return picked;
}

function fallbackQuestionByType(interviewType) {
  if (interviewType === "behavioral") {
    return {
      topic: "introduction",
      text: "Tell me about a recent situation where you handled a difficult team challenge and what specific actions you took.",
    };
  }
  if (interviewType === "system_design") {
    return {
      topic: "requirements",
      text: "Design a URL shortener. Start by clarifying functional and non-functional requirements.",
    };
  }
  return {
    topic: "resume_projects",
    text: "Walk me through one project you are most proud of, your exact role, key technical decisions, and trade-offs.",
  };
}

/** Google Meet-style: three groups, 10 lowercase letters (e.g. kzg-jxqc-nwp). */
function randomLowerSegment(len) {
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + randomInt(0, 26)),
  ).join("");
}

function createRoomId() {
  return `${randomLowerSegment(3)}-${randomLowerSegment(4)}-${randomLowerSegment(3)}`;
}

function isDuplicateRoomIdError(err) {
  if (!err || err.code !== 11000) return false;
  if (err.keyPattern && err.keyPattern.roomId === 1) return true;
  return err.keyValue && Object.hasOwn(err.keyValue, "roomId");
}

async function createInterviewDocument(payload) {
  for (let attempt = 0; attempt < ALLOCATE_ROOM_MAX_ATTEMPTS; attempt++) {
    const roomId = createRoomId();
    if (await Interview.exists({ roomId })) continue;
    try {
      return await Interview.create({ ...payload, roomId });
    } catch (err) {
      if (isDuplicateRoomIdError(err)) continue;
      throw err;
    }
  }
  throw new HttpError(500, "Could not allocate a unique room code");
}

function templateToConfig(interviewType, source) {
  const fallback = getInterviewPromptTemplate(interviewType);
  const version =
    Number(source?.version || 0) > 0
      ? Number(source.version)
      : Number(fallback.version || 1);

  return {
    interviewType,
    key: sanitizeText(source?.key || fallback.key, 120) || fallback.key,
    version,
    maxQuestions: Math.max(
      1,
      Math.min(50, Number(source?.maxQuestions || fallback.maxQuestions || 8)),
    ),
    allowedTopics: sanitizeStringArray(
      source?.allowedTopics || fallback.allowedTopics,
      100,
      80,
    ),
    systemPrompt:
      sanitizeText(
        source?.systemPrompt || source?.template || fallback.systemPrompt,
        40000,
      ) || fallback.systemPrompt,
  };
}

async function getOrCreateActiveBasePromptTemplate(interviewType) {
  const active = await InterviewPromptTemplate.findOne({
    interviewType,
    isActive: true,
  })
    .sort({ version: -1 })
    .exec();
  if (active) return templateToConfig(interviewType, active);

  const fallback = templateToConfig(interviewType);
  try {
    await InterviewPromptTemplate.create({
      interviewType,
      key: fallback.key,
      version: fallback.version,
      systemPrompt: fallback.systemPrompt,
      template: fallback.systemPrompt,
      maxQuestions: fallback.maxQuestions,
      allowedTopics: fallback.allowedTopics,
      isActive: true,
    });
  } catch {
    // If this races, or key/version already exists, resolve to existing row.
    const existingByKey = await InterviewPromptTemplate.findOne({
      key: fallback.key,
    }).exec();
    if (existingByKey) {
      existingByKey.interviewType = interviewType;
      existingByKey.version = fallback.version;
      existingByKey.systemPrompt = fallback.systemPrompt;
      existingByKey.template = fallback.systemPrompt;
      existingByKey.maxQuestions = fallback.maxQuestions;
      existingByKey.allowedTopics = fallback.allowedTopics;
      existingByKey.isActive = true;
      await existingByKey.save();
    }
  }

  const resolved = await InterviewPromptTemplate.findOne({
    interviewType,
    isActive: true,
  })
    .sort({ version: -1 })
    .exec();

  if (resolved) return templateToConfig(interviewType, resolved);

  const byVersion = await InterviewPromptTemplate.findOne({
    interviewType,
    version: fallback.version,
  }).exec();
  if (byVersion) {
    if (!byVersion.isActive) {
      byVersion.isActive = true;
      await byVersion.save();
    }
    return templateToConfig(interviewType, byVersion);
  }

  return fallback;
}

async function getPromptTemplateByVersion(interviewType, basePromptVersion) {
  const version = Number(basePromptVersion || 0);
  if (version > 0) {
    const doc = await InterviewPromptTemplate.findOne({
      interviewType,
      version,
    }).exec();
    if (doc) return templateToConfig(interviewType, doc);
  }
  return getOrCreateActiveBasePromptTemplate(interviewType);
}

async function callGeminiForJson(promptText) {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new HttpError(503, "GEMINI_API_KEY is not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL,
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      payload?.error?.message || `Gemini API error (${res.status})`;
    throw new HttpError(502, message);
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

async function elevenLabsTextToSpeech(text, voiceId) {
  const apiKey = String(process.env.ELEVENLABS_API_KEY || "").trim();
  if (!apiKey || !voiceId || !String(text || "").trim()) {
    return null;
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId,
    )}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVEN_TTS_MODEL,
      }),
    },
  );
  if (!res.ok) {
    return null;
  }
  const arr = await res.arrayBuffer();
  return {
    mimeType: "audio/mpeg",
    base64: Buffer.from(arr).toString("base64"),
  };
}

async function elevenLabsSpeechToText({
  audioBase64,
  mimeType = "audio/webm",
  languageCode = "",
}) {
  const apiKey = String(process.env.ELEVENLABS_API_KEY || "").trim();
  if (!apiKey || !audioBase64) return "";

  const binary = Buffer.from(String(audioBase64), "base64");
  if (!binary.length) return "";

  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp3")
      ? "mp3"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";

  const form = new FormData();
  form.append("model_id", ELEVEN_STT_MODEL);
  if (languageCode) {
    form.append("language_code", languageCode);
  }
  form.append(
    "file",
    new Blob([binary], { type: mimeType }),
    `candidate-answer.${ext}`,
  );

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return "";
  }
  return sanitizeText(payload?.text, ANSWER_MAX_LEN);
}

function fallbackAiResponse(interviewType, note = "") {
  const q = fallbackQuestionByType(interviewType);
  return {
    answerEvaluation: {
      quality: "average",
      relevanceScore: 0,
      clarityScore: 0,
      technicalDepthScore: 0,
      confidenceScore: 0,
      notes: note || "Fallback response used",
    },
    interviewDecision: {
      action: "follow_up",
      reason: note || "Fallback response used",
    },
    policy: {
      warningToCandidate: "",
      suspendInterview: false,
      suspendReason: "",
      abusiveLanguageDetected: false,
      cheatingSuspicionDetected: false,
      quitIntentDetected: false,
      quitConfirmed: false,
      flags: note ? ["fallback_mode"] : [],
    },
    nextQuestion: q,
    runningSummaryUpdate: "",
  };
}

function normalizeAiResponseShape(aiResponse, interviewType) {
  const fallback = fallbackAiResponse(interviewType);
  const source = aiResponse && typeof aiResponse === "object" ? aiResponse : {};
  const next = source.nextQuestion || {};
  return {
    answerEvaluation: source.answerEvaluation || fallback.answerEvaluation,
    interviewDecision: source.interviewDecision || fallback.interviewDecision,
    policy: source.policy || fallback.policy,
    nextQuestion: {
      topic: sanitizeText(next.topic, CONTEXT_ITEM_MAX_LEN) || fallback.nextQuestion.topic,
      text: sanitizeText(next.text, QUESTION_MAX_LEN) || fallback.nextQuestion.text,
    },
    runningSummaryUpdate:
      sanitizeText(source.runningSummaryUpdate, RUNNING_SUMMARY_MAX_LEN) ||
      fallback.runningSummaryUpdate,
  };
}

function ensureRuntimeStateDefaults(doc, template) {
  const runtime = doc.runtimeState || {};
  runtime.difficulty = sanitizeDifficulty(runtime.difficulty);
  runtime.currentQuestionNumber = Number(runtime.currentQuestionNumber || 0);
  runtime.maxQuestions = Number(runtime.maxQuestions || template.maxQuestions || 8);
  runtime.askedTopics = sanitizeStringArray(runtime.askedTopics, ASKED_TOPICS_MAX);
  runtime.runningSummary = sanitizeText(runtime.runningSummary, RUNNING_SUMMARY_MAX_LEN);
  runtime.lastQuestion = sanitizeText(runtime.lastQuestion, QUESTION_MAX_LEN);
  runtime.lastCandidateAnswer = sanitizeText(runtime.lastCandidateAnswer, ANSWER_MAX_LEN);
  runtime.warningCount = Number(runtime.warningCount || 0);
  runtime.abusiveLanguageCount = Number(runtime.abusiveLanguageCount || 0);
  runtime.cheatingSignalCount = Number(runtime.cheatingSignalCount || 0);
  runtime.quitIntentCount = Number(runtime.quitIntentCount || 0);
  runtime.interviewer = normalizeInterviewerProfile(runtime.interviewer);
  runtime.integrityEvents = Array.isArray(runtime.integrityEvents)
    ? runtime.integrityEvents.slice(-INTEGRITY_EVENTS_MAX)
    : [];
  runtime.initialPromptPayload = runtime.initialPromptPayload || null;
  runtime.currentPromptPayload = runtime.currentPromptPayload || null;
  runtime.startedAt = runtime.startedAt || null;
  runtime.promptGeneratedAt = runtime.promptGeneratedAt || null;
  doc.runtimeState = runtime;
}

function addUniqueString(list, value, maxItems = ASKED_TOPICS_MAX) {
  const normalized = sanitizeText(value, CONTEXT_ITEM_MAX_LEN);
  if (!normalized) return list || [];
  const out = Array.isArray(list) ? [...list] : [];
  if (!out.some((x) => String(x).toLowerCase() === normalized.toLowerCase())) {
    out.push(normalized);
  }
  return out.slice(-maxItems);
}

function pushIntegrityEvent(runtime, event) {
  const type = sanitizeText(event?.type, 80);
  if (!type) return;
  const severity = sanitizeText(event?.severity || "info", 32) || "info";
  const note = sanitizeText(event?.note, 2000);
  const entry = {
    type,
    severity,
    note,
    createdAt: new Date(),
  };

  runtime.integrityEvents = Array.isArray(runtime.integrityEvents)
    ? runtime.integrityEvents
    : [];
  runtime.integrityEvents.push(entry);
  if (runtime.integrityEvents.length > INTEGRITY_EVENTS_MAX) {
    runtime.integrityEvents = runtime.integrityEvents.slice(
      -INTEGRITY_EVENTS_MAX,
    );
  }
}

function parsePolicy(aiResponse) {
  const policy = aiResponse?.policy || {};
  return {
    warningToCandidate: sanitizeText(policy.warningToCandidate, POLICY_REASON_MAX_LEN),
    suspendInterview: Boolean(policy.suspendInterview),
    suspendReason: sanitizeText(policy.suspendReason, POLICY_REASON_MAX_LEN),
    abusiveLanguageDetected: Boolean(policy.abusiveLanguageDetected),
    cheatingSuspicionDetected: Boolean(policy.cheatingSuspicionDetected),
    quitIntentDetected: Boolean(policy.quitIntentDetected),
    quitConfirmed: Boolean(policy.quitConfirmed),
    flags: sanitizeStringArray(policy.flags, 12, 80),
  };
}

function applyPolicyOutcome(doc, aiResponse) {
  const runtime = doc.runtimeState || {};
  const policy = parsePolicy(aiResponse);
  const action = String(aiResponse?.interviewDecision?.action || "")
    .trim()
    .toLowerCase();
  const actionReason = sanitizeText(
    aiResponse?.interviewDecision?.reason,
    POLICY_REASON_MAX_LEN,
  );

  if (policy.warningToCandidate || action === "warn_candidate") {
    runtime.warningCount = Number(runtime.warningCount || 0) + 1;
    pushIntegrityEvent(runtime, {
      type: "warning_issued",
      severity: "warning",
      note: policy.warningToCandidate || actionReason || "Policy warning issued",
    });
  }

  if (policy.abusiveLanguageDetected) {
    runtime.abusiveLanguageCount = Number(runtime.abusiveLanguageCount || 0) + 1;
    pushIntegrityEvent(runtime, {
      type: "abusive_language_detected",
      severity: "warning",
      note: actionReason || "Abusive or offensive language detected",
    });
    if (!policy.warningToCandidate && action !== "warn_candidate" && runtime.abusiveLanguageCount === 1) {
      runtime.warningCount = Number(runtime.warningCount || 0) + 1;
      pushIntegrityEvent(runtime, {
        type: "warning_issued",
        severity: "warning",
        note: "Automatic warning issued for abusive language",
      });
    }
  }

  if (policy.cheatingSuspicionDetected) {
    runtime.cheatingSignalCount = Number(runtime.cheatingSignalCount || 0) + 1;
    pushIntegrityEvent(runtime, {
      type: "cheating_suspicion_detected",
      severity: "warning",
      note:
        actionReason ||
        "Suspicion of external/AI assistance detected from response pattern",
    });
    if (
      !policy.warningToCandidate &&
      action !== "warn_candidate" &&
      runtime.cheatingSignalCount === 1
    ) {
      runtime.warningCount = Number(runtime.warningCount || 0) + 1;
      pushIntegrityEvent(runtime, {
        type: "warning_issued",
        severity: "warning",
        note: "Automatic warning issued for suspicious assistance behavior",
      });
    }
  }

  if (policy.quitIntentDetected) {
    runtime.quitIntentCount = Number(runtime.quitIntentCount || 0) + 1;
    pushIntegrityEvent(runtime, {
      type: "quit_intent_detected",
      severity: "info",
      note: actionReason || "Candidate requested to quit",
    });
  }

  for (const flag of policy.flags) {
    pushIntegrityEvent(runtime, {
      type: "policy_flag",
      severity: "info",
      note: flag,
    });
  }

  let shouldSuspend = policy.suspendInterview || action === "suspend_interview";
  let suspendReason = policy.suspendReason || actionReason;

  if (!shouldSuspend && runtime.abusiveLanguageCount >= ABUSE_SUSPEND_THRESHOLD) {
    shouldSuspend = true;
    suspendReason =
      suspendReason || "Repeated abusive language after warning(s)";
  }
  if (!shouldSuspend && runtime.cheatingSignalCount >= CHEATING_SUSPEND_THRESHOLD) {
    shouldSuspend = true;
    suspendReason =
      suspendReason || "Repeated suspicious external/AI assistance behavior";
  }

  if (shouldSuspend) {
    doc.status = "suspended";
    doc.suspendedReason =
      suspendReason ||
      "Interview suspended due to repeated policy violations";
    pushIntegrityEvent(runtime, {
      type: "interview_suspended",
      severity: "critical",
      note: doc.suspendedReason,
    });
    doc.runtimeState = runtime;
    return { action, policy, suspended: true };
  }

  if (action === "end_interview") {
    if (policy.quitIntentDetected && !policy.quitConfirmed) {
      pushIntegrityEvent(runtime, {
        type: "quit_needs_resolution",
        severity: "info",
        note: "Quit requested but not confirmed; continue with resolution step",
      });
    } else {
      doc.status = "completed";
    }
  }

  doc.runtimeState = runtime;
  return { action, policy, suspended: false };
}

function toPublicInterview(doc, { includeResume = false } = {}) {
  const o = doc.toObject ? doc.toObject() : doc;
  const candidate = o.candidateId && typeof o.candidateId === "object" ? o.candidateId : null;
  const scheduledBy =
    o.scheduledById && typeof o.scheduledById === "object" ? o.scheduledById : null;

  const candidateContext = o.candidateContext || {};
  const runtimeState = o.runtimeState || {};
  const yearsOfExperience =
    candidateContext.yearsOfExperience ??
    o.yearsOfExperience ??
    (o.yearsExperience === null || o.yearsExperience === undefined
      ? null
      : Number(o.yearsExperience));

  const skills = Array.isArray(candidateContext.skills) ? candidateContext.skills : [];
  const projects = Array.isArray(candidateContext.projects) ? candidateContext.projects : [];
  const askedTopics = Array.isArray(runtimeState.askedTopics) ? runtimeState.askedTopics : [];
  const interviewer = normalizeInterviewerProfile(runtimeState.interviewer);
  const integrityEvents = Array.isArray(runtimeState.integrityEvents)
    ? runtimeState.integrityEvents
    : [];

  return {
    id: o._id.toString(),
    roomId: o.roomId,
    candidateId: candidate?._id?.toString() || String(o.candidateId),
    candidate: candidate
      ? {
          id: candidate._id.toString(),
          name: candidate.name || "",
          email: candidate.email || "",
          avatarUrl: candidate.avatarUrl || "",
        }
      : null,
    scheduledById: scheduledBy?._id?.toString() || String(o.scheduledById),
    scheduledBy: scheduledBy
      ? {
          id: scheduledBy._id.toString(),
          name: scheduledBy.name || "",
          email: scheduledBy.email || "",
        }
      : null,
    interviewType: o.interviewType,
    basePromptKey: o.basePromptKey || "",
    basePromptVersion: Number(o.basePromptVersion || 1),
    hasResume: Boolean(o.resumeUrl && String(o.resumeUrl).trim()),
    ...(includeResume ? { resumeUrl: o.resumeUrl || "" } : {}),
    yearsExperience: yearsOfExperience,
    yearsOfExperience,
    durationMinutes: o.durationMinutes,
    duration: o.durationMinutes,
    resumeSummary: candidateContext.resumeSummary || "",
    skills,
    projects,
    difficulty: runtimeState.difficulty || DEFAULT_INTERVIEW_DIFFICULTY,
    currentQuestionNumber: Number(runtimeState.currentQuestionNumber || 0),
    maxQuestions: Number(runtimeState.maxQuestions || 0),
    askedTopics,
    runningSummary: runtimeState.runningSummary || "",
    lastQuestion: runtimeState.lastQuestion || "",
    warningCount: Number(runtimeState.warningCount || 0),
    abusiveLanguageCount: Number(runtimeState.abusiveLanguageCount || 0),
    cheatingSignalCount: Number(runtimeState.cheatingSignalCount || 0),
    quitIntentCount: Number(runtimeState.quitIntentCount || 0),
    interviewer,
    integrityEvents,
    candidateContext: {
      resumeSummary: candidateContext.resumeSummary || "",
      skills,
      projects,
      yearsOfExperience,
    },
    runtimeState: {
      difficulty: runtimeState.difficulty || DEFAULT_INTERVIEW_DIFFICULTY,
      currentQuestionNumber: Number(runtimeState.currentQuestionNumber || 0),
      maxQuestions: Number(runtimeState.maxQuestions || 0),
      askedTopics,
      runningSummary: runtimeState.runningSummary || "",
      lastQuestion: runtimeState.lastQuestion || "",
      lastCandidateAnswer: runtimeState.lastCandidateAnswer || "",
      warningCount: Number(runtimeState.warningCount || 0),
      abusiveLanguageCount: Number(runtimeState.abusiveLanguageCount || 0),
      cheatingSignalCount: Number(runtimeState.cheatingSignalCount || 0),
      quitIntentCount: Number(runtimeState.quitIntentCount || 0),
      interviewer,
      startedAt: runtimeState.startedAt || null,
      promptGeneratedAt: runtimeState.promptGeneratedAt || null,
      initialPromptReady: Boolean(runtimeState.initialPromptPayload),
      currentPromptReady: Boolean(runtimeState.currentPromptPayload),
      integrityEvents,
    },
    status: o.status,
    suspendedReason: o.suspendedReason || "",
    reportPlaceholder: o.reportPlaceholder || "",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Normalize user input: strips non-letters, lowercases, formats as xxx-xxxx-xxx.
 * Returns null if not exactly 10 letters.
 */
export function normalizeRoomId(raw) {
  const letters = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (letters.length !== 10) return null;
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7, 10)}`;
}

async function getCandidateInterviewByRoom(actor, rawRoomId) {
  const normalized = normalizeRoomId(rawRoomId);
  if (!normalized) {
    throw new HttpError(
      400,
      "Enter a valid room code (10 letters, e.g. abc-defg-hij)",
    );
  }

  const doc = await Interview.findOne({ roomId: normalized })
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();
  if (!doc) {
    throw new HttpError(404, "No interview found for this room code");
  }

  const assignedId =
    doc.candidateId && typeof doc.candidateId === "object"
      ? doc.candidateId._id.toString()
      : String(doc.candidateId);
  if (assignedId !== actor._id.toString()) {
    throw new HttpError(403, "This interview is not assigned to your account");
  }

  if (doc.status === "deleted") {
    throw new HttpError(404, "Interview not found");
  }
  if (doc.status === "suspended") {
    throw new HttpError(
      403,
      "This interview is not available. Contact your organizer if you need help.",
    );
  }

  return doc;
}

export async function lookupInterviewByRoomForCandidate(actor, rawRoomId) {
  const doc = await getCandidateInterviewByRoom(actor, rawRoomId);
  return { interview: toPublicInterview(doc, { includeResume: false }) };
}

export async function startInterviewByRoomForCandidate(actor, rawRoomId) {
  const doc = await getCandidateInterviewByRoom(actor, rawRoomId);
  if (doc.status === "completed") {
    throw new HttpError(409, "This interview is already completed");
  }

  const template = await getPromptTemplateByVersion(
    doc.interviewType,
    doc.basePromptVersion,
  );

  ensureRuntimeStateDefaults(doc, template);
  const selectedInterviewer = await resolveInterviewerProfileForInterview(doc);
  if (!doc.runtimeState.startedAt) {
    doc.runtimeState.startedAt = new Date();
  }
  doc.runtimeState.promptGeneratedAt = new Date();
  if (doc.status === "scheduled") {
    doc.status = "in_progress";
  }

  const initialPayload =
    doc.runtimeState.initialPromptPayload ||
    buildInitialPromptPayload({
      interview: doc,
      candidate: doc.candidateId,
      template,
    });
  doc.runtimeState.initialPromptPayload = initialPayload;
  if (!doc.runtimeState.lastQuestion) {
    let firstAiResponse;
    try {
      firstAiResponse = await callGeminiForJson(buildGeminiPromptText(initialPayload));
    } catch (err) {
      firstAiResponse = fallbackAiResponse(
        doc.interviewType,
        err?.message || "Gemini unavailable",
      );
    }
    const normalizedFirstResponse = normalizeAiResponseShape(
      firstAiResponse,
      doc.interviewType,
    );

    doc.runtimeState.currentQuestionNumber = 1;
    doc.runtimeState.lastCandidateAnswer = "";
    doc.runtimeState.lastQuestion = normalizedFirstResponse.nextQuestion.text;
    doc.runtimeState.askedTopics = addUniqueString(
      doc.runtimeState.askedTopics,
      normalizedFirstResponse.nextQuestion.topic,
      ASKED_TOPICS_MAX,
    );
    if (normalizedFirstResponse.runningSummaryUpdate) {
      doc.runtimeState.runningSummary = sanitizeText(
        normalizedFirstResponse.runningSummaryUpdate,
        RUNNING_SUMMARY_MAX_LEN,
      );
    }

    const nextPayload = buildNextTurnPromptPayload({
      interview: doc,
      candidateAnswer: "",
      template,
    });
    doc.runtimeState.currentPromptPayload = nextPayload;
  }

  await doc.save();

  const populated = await Interview.findById(doc._id)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  const interviewer =
    normalizeInterviewerProfile(populated?.runtimeState?.interviewer) ||
    selectedInterviewer ||
    fallbackInterviewerProfile();
  const initialQuestion = sanitizeText(
    populated.runtimeState?.lastQuestion,
    QUESTION_MAX_LEN,
  );
  const ttsAudio = await elevenLabsTextToSpeech(
    initialQuestion,
    interviewer.voiceId,
  );

  return {
    interview: toPublicInterview(populated, { includeResume: false }),
    interviewer: {
      id: interviewer.id,
      name: interviewer.name,
      gender: interviewer.gender,
      avatarStyle: interviewer.avatarStyle,
      voiceEnabled: Boolean(interviewer.voiceId),
    },
    initialPromptPayload: populated.runtimeState?.initialPromptPayload || initialPayload,
    currentPromptPayload: populated.runtimeState?.currentPromptPayload || null,
    question: {
      topic: populated.runtimeState?.askedTopics?.slice(-1)[0] || "",
      text: initialQuestion,
    },
    audio: ttsAudio,
    finalPrompt: buildGeminiPromptText(
      populated.runtimeState?.initialPromptPayload || initialPayload,
    ),
    promptMeta: {
      interviewType: template.interviewType,
      basePromptKey: template.key,
      basePromptVersion: template.version,
      maxQuestions: template.maxQuestions,
      allowedTopics: template.allowedTopics,
    },
  };
}

export async function endInterviewByRoomForCandidate(actor, rawRoomId, body = {}) {
  const doc = await getCandidateInterviewByRoom(actor, rawRoomId);
  if (doc.status === "completed") {
    return {
      interview: toPublicInterview(doc, { includeResume: false }),
      ended: true,
    };
  }

  const template = await getPromptTemplateByVersion(
    doc.interviewType,
    doc.basePromptVersion,
  );
  ensureRuntimeStateDefaults(doc, template);

  if (!doc.runtimeState.startedAt) {
    doc.runtimeState.startedAt = new Date();
  }

  const endReason =
    sanitizeText(body?.reason, POLICY_REASON_MAX_LEN) ||
    "Candidate ended the call intentionally";

  pushIntegrityEvent(doc.runtimeState, {
    type: "candidate_ended_call",
    severity: "info",
    note: endReason,
  });

  if (!doc.runtimeState.runningSummary) {
    doc.runtimeState.runningSummary = sanitizeText(
      `Interview ended by candidate. ${endReason}`,
      RUNNING_SUMMARY_MAX_LEN,
    );
  }

  doc.status = "completed";
  await doc.save();

  const populated = await Interview.findById(doc._id)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return {
    interview: toPublicInterview(populated, { includeResume: false }),
    ended: true,
  };
}

export async function createInterview(actor, body) {
  const candidateId = sanitizeText(body.candidateId, 200);
  const interviewType = normalizeInterviewType(body.interviewType);
  const resumeUrl = sanitizeResume(body.resumeUrl);
  const durationMinutes = Number(
    body.durationMinutes ?? DEFAULT_INTERVIEW_DURATION_MIN,
  );

  if (!candidateId) {
    throw new HttpError(400, "candidateId is required");
  }
  if (!interviewType) {
    throw new HttpError(400, "Interview type is required");
  }
  if (!INTERVIEW_TYPE_PRESETS.includes(interviewType)) {
    throw new HttpError(
      400,
      `Interview type must be one of: ${INTERVIEW_TYPE_PRESETS.join(", ")}`,
    );
  }
  if (
    Number.isNaN(durationMinutes) ||
    durationMinutes < MIN_INTERVIEW_DURATION_MIN ||
    durationMinutes > MAX_INTERVIEW_DURATION_MIN
  ) {
    throw new HttpError(
      400,
      `Duration must be between ${MIN_INTERVIEW_DURATION_MIN} and ${MAX_INTERVIEW_DURATION_MIN} minutes`,
    );
  }

  const yearsOfExperience = parseYearsOfExperience(
    body.yearsOfExperience ?? body.yearsExperience,
  );
  if (!resumeUrl && yearsOfExperience === null) {
    throw new HttpError(
      400,
      "Years of experience is required when no resume is uploaded",
    );
  }

  const candidate = await User.findById(candidateId);
  if (!candidate || candidate.role !== "candidate") {
    throw new HttpError(400, "Invalid candidate");
  }
  if (!candidate.activeStatus) {
    throw new HttpError(400, "Candidate account is inactive");
  }

  const template = await getOrCreateActiveBasePromptTemplate(interviewType);
  const resumeSummary = sanitizeText(body.resumeSummary, RESUME_SUMMARY_MAX_LEN);
  const skills = sanitizeStringArray(body.skills);
  const projects = sanitizeStringArray(body.projects);
  const difficulty = sanitizeDifficulty(body.difficulty);

  const doc = await createInterviewDocument({
    candidateId: candidate._id,
    scheduledById: actor._id,
    interviewType,
    basePromptKey: template.key,
    basePromptVersion: template.version,
    resumeUrl,
    yearsExperience: yearsOfExperience,
    yearsOfExperience,
    durationMinutes,
    candidateContext: {
      resumeSummary,
      skills,
      projects,
      yearsOfExperience,
    },
    runtimeState: {
      difficulty,
      currentQuestionNumber: 0,
      maxQuestions: template.maxQuestions,
      askedTopics: [],
      runningSummary: "",
      lastQuestion: "",
      lastCandidateAnswer: "",
      warningCount: 0,
      abusiveLanguageCount: 0,
      cheatingSignalCount: 0,
      quitIntentCount: 0,
      interviewer: null,
      integrityEvents: [],
      initialPromptPayload: null,
      currentPromptPayload: null,
      startedAt: null,
      promptGeneratedAt: null,
    },
    status: "scheduled",
  });

  const populated = await Interview.findById(doc._id)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return { interview: toPublicInterview(populated, { includeResume: true }) };
}

export async function listInterviews(_actor, query) {
  const status = String(query.status || "").trim();
  const candidateId = String(query.candidateId || "").trim();
  const includeDeleted = String(query.includeDeleted || "") === "1";

  const q = {};
  if (status && INTERVIEW_STATUSES.includes(status)) {
    q.status = status;
  } else if (!includeDeleted) {
    q.status = { $ne: "deleted" };
  }
  if (candidateId) {
    q.candidateId = candidateId;
  }

  const rows = await Interview.find(q)
    .sort({ createdAt: -1 })
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return {
    interviews: rows.map((d) => toPublicInterview(d, { includeResume: false })),
  };
}

export async function listInterviewsForCandidate(actor, query = {}) {
  const status = String(query.status || "").trim();
  const includeDeleted = String(query.includeDeleted || "") === "1";
  const q = { candidateId: actor._id };

  if (status && INTERVIEW_STATUSES.includes(status)) {
    q.status = status;
  } else if (!includeDeleted) {
    q.status = { $ne: "deleted" };
  }

  const rows = await Interview.find(q)
    .sort({ createdAt: -1 })
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return {
    interviews: rows.map((d) => toPublicInterview(d, { includeResume: false })),
  };
}

export async function getInterviewById(_actor, interviewId) {
  const doc = await Interview.findById(interviewId)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();
  if (!doc || doc.status === "deleted") {
    throw new HttpError(404, "Interview not found");
  }
  return { interview: toPublicInterview(doc, { includeResume: true }) };
}

export async function updateInterview(_actor, interviewId, body) {
  const doc = await Interview.findById(interviewId);
  if (!doc) {
    throw new HttpError(404, "Interview not found");
  }

  const template = await getPromptTemplateByVersion(
    doc.interviewType,
    doc.basePromptVersion,
  );
  ensureRuntimeStateDefaults(doc, template);

  if (body.status !== undefined) {
    const next = String(body.status || "").trim();
    if (!INTERVIEW_STATUSES.includes(next)) {
      throw new HttpError(400, "Invalid status");
    }
    doc.status = next;
    if (next === "suspended") {
      doc.suspendedReason = sanitizeText(body.suspendedReason, POLICY_REASON_MAX_LEN);
    } else {
      doc.suspendedReason = "";
    }
  }

  if (body.difficulty !== undefined) {
    doc.runtimeState.difficulty = sanitizeDifficulty(body.difficulty);
  }
  if (body.askedTopics !== undefined) {
    doc.runtimeState.askedTopics = sanitizeStringArray(
      body.askedTopics,
      ASKED_TOPICS_MAX,
      CONTEXT_ITEM_MAX_LEN,
    );
  }
  if (body.runningSummary !== undefined) {
    doc.runtimeState.runningSummary = sanitizeText(
      body.runningSummary,
      RUNNING_SUMMARY_MAX_LEN,
    );
  }

  await doc.save();
  const populated = await Interview.findById(doc._id)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return { interview: toPublicInterview(populated, { includeResume: false }) };
}

export async function recordInterviewTurnResult(
  _actor,
  interviewId,
  body,
) {
  const doc = await Interview.findById(interviewId)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();
  if (!doc || doc.status === "deleted") {
    throw new HttpError(404, "Interview not found");
  }
  if (doc.status === "suspended") {
    throw new HttpError(409, "Interview is suspended");
  }
  if (doc.status === "completed") {
    throw new HttpError(409, "Interview is already completed");
  }

  const aiResponse = body?.aiResponse;
  if (!aiResponse || typeof aiResponse !== "object") {
    throw new HttpError(400, "aiResponse is required");
  }

  const template = await getPromptTemplateByVersion(
    doc.interviewType,
    doc.basePromptVersion,
  );
  ensureRuntimeStateDefaults(doc, template);
  if (doc.status === "scheduled") {
    doc.status = "in_progress";
  }
  if (!doc.runtimeState.startedAt) {
    doc.runtimeState.startedAt = new Date();
  }

  const candidateAnswer = sanitizeText(body?.candidateAnswer, ANSWER_MAX_LEN);
  doc.runtimeState.lastCandidateAnswer = candidateAnswer;
  doc.runtimeState.currentQuestionNumber = Number(
    doc.runtimeState.currentQuestionNumber || 0,
  ) + 1;

  const nextTopic = sanitizeText(aiResponse?.nextQuestion?.topic, CONTEXT_ITEM_MAX_LEN);
  const nextQuestion = sanitizeText(aiResponse?.nextQuestion?.text, QUESTION_MAX_LEN);
  if (nextTopic) {
    doc.runtimeState.askedTopics = addUniqueString(
      doc.runtimeState.askedTopics,
      nextTopic,
      ASKED_TOPICS_MAX,
    );
  }
  if (nextQuestion) {
    doc.runtimeState.lastQuestion = nextQuestion;
  }

  if (aiResponse?.runningSummaryUpdate !== undefined) {
    doc.runtimeState.runningSummary = sanitizeText(
      aiResponse.runningSummaryUpdate,
      RUNNING_SUMMARY_MAX_LEN,
    );
  }

  const policyResult = applyPolicyOutcome(doc, aiResponse);

  let nextPromptPayload = null;
  let nextPromptText = null;
  if (doc.status !== "suspended" && doc.status !== "completed") {
    nextPromptPayload = buildNextTurnPromptPayload({
      interview: doc,
      candidateAnswer,
      template,
    });
    doc.runtimeState.currentPromptPayload = nextPromptPayload;
    doc.runtimeState.promptGeneratedAt = new Date();
    nextPromptText = buildGeminiPromptText(nextPromptPayload);
  } else {
    doc.runtimeState.currentPromptPayload = null;
  }

  await doc.save();

  const populated = await Interview.findById(doc._id)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return {
    interview: toPublicInterview(populated, { includeResume: false }),
    nextPromptPayload,
    nextPromptText,
    policyResult: {
      action: policyResult.action,
      suspended: policyResult.suspended,
      warningToCandidate: policyResult.policy.warningToCandidate,
      suspendReason: populated.suspendedReason || "",
    },
  };
}

export async function processCandidateTurnByRoom(actor, rawRoomId, body) {
  const doc = await getCandidateInterviewByRoom(actor, rawRoomId);
  if (doc.status === "completed") {
    throw new HttpError(409, "This interview is already completed");
  }

  const template = await getPromptTemplateByVersion(
    doc.interviewType,
    doc.basePromptVersion,
  );
  ensureRuntimeStateDefaults(doc, template);
  const hadPersistedInterviewer = Boolean(
    normalizeInterviewerProfile(doc.runtimeState?.interviewer)?.id,
  );
  const selectedInterviewer = await resolveInterviewerProfileForInterview(doc);

  let answerText = sanitizeText(body?.answerText, ANSWER_MAX_LEN);
  const answerAudioBase64 = sanitizeText(body?.answerAudioBase64, 50 * 1024 * 1024);
  const answerAudioMimeType = sanitizeText(body?.answerAudioMimeType, 100) || "audio/webm";
  const forceNextQuestion = Boolean(body?.forceNextQuestion);

  if (!answerText && answerAudioBase64) {
    const transcript = await elevenLabsSpeechToText({
      audioBase64: answerAudioBase64,
      mimeType: answerAudioMimeType,
      languageCode: sanitizeText(body?.languageCode, 10),
    });
    answerText = sanitizeText(transcript, ANSWER_MAX_LEN);
  }

  const isFirstTurn =
    Number(doc.runtimeState.currentQuestionNumber || 0) === 0 ||
    !sanitizeText(doc.runtimeState.lastQuestion, QUESTION_MAX_LEN);

  if (!isFirstTurn && !answerText && !forceNextQuestion) {
    throw new HttpError(
      400,
      "Provide answerText or answerAudioBase64 before requesting next question",
    );
  }

  let promptPayload;
  if (isFirstTurn) {
    promptPayload =
      doc.runtimeState.initialPromptPayload ||
      buildInitialPromptPayload({
        interview: doc,
        candidate: doc.candidateId,
        template,
      });
    doc.runtimeState.initialPromptPayload = promptPayload;
  } else {
    promptPayload =
      doc.runtimeState.currentPromptPayload ||
      buildNextTurnPromptPayload({
        interview: doc,
        candidateAnswer: answerText,
        template,
      });
  }

  let aiResponseRaw;
  try {
    aiResponseRaw = await callGeminiForJson(buildGeminiPromptText(promptPayload));
  } catch (err) {
    aiResponseRaw = fallbackAiResponse(
      doc.interviewType,
      err?.message || "Gemini unavailable",
    );
  }
  const aiResponse = normalizeAiResponseShape(aiResponseRaw, doc.interviewType);

  let result;
  if (isFirstTurn) {
    doc.runtimeState.currentQuestionNumber = 1;
    doc.runtimeState.lastCandidateAnswer = "";
    doc.runtimeState.lastQuestion = aiResponse.nextQuestion.text;
    doc.runtimeState.askedTopics = addUniqueString(
      doc.runtimeState.askedTopics,
      aiResponse.nextQuestion.topic,
      ASKED_TOPICS_MAX,
    );
    if (aiResponse.runningSummaryUpdate) {
      doc.runtimeState.runningSummary = sanitizeText(
        aiResponse.runningSummaryUpdate,
        RUNNING_SUMMARY_MAX_LEN,
      );
    }
    if (doc.status === "scheduled") {
      doc.status = "in_progress";
    }

    const nextPayload = buildNextTurnPromptPayload({
      interview: doc,
      candidateAnswer: "",
      template,
    });
    doc.runtimeState.currentPromptPayload = nextPayload;
    doc.runtimeState.promptGeneratedAt = new Date();
    await doc.save();

    const populated = await Interview.findById(doc._id)
      .populate("candidateId", "email name avatarUrl")
      .populate("scheduledById", "email name")
      .exec();

    result = {
      interview: toPublicInterview(populated, { includeResume: false }),
      nextPromptPayload: nextPayload,
      nextPromptText: buildGeminiPromptText(nextPayload),
      policyResult: {
        action: aiResponse?.interviewDecision?.action || "follow_up",
        suspended: false,
        warningToCandidate: aiResponse?.policy?.warningToCandidate || "",
        suspendReason: "",
      },
    };
  } else {
    if (!hadPersistedInterviewer) {
      await doc.save();
    }
    result = await recordInterviewTurnResult(actor, doc._id, {
      candidateAnswer: answerText,
      aiResponse,
    });
  }

  const interviewer =
    normalizeInterviewerProfile(result?.interview?.runtimeState?.interviewer) ||
    selectedInterviewer ||
    fallbackInterviewerProfile();
  const nextQuestionText = sanitizeText(
    result.interview?.lastQuestion || aiResponse?.nextQuestion?.text,
    QUESTION_MAX_LEN,
  );
  const ttsAudio = await elevenLabsTextToSpeech(nextQuestionText, interviewer.voiceId);

  return {
    ...result,
    interviewer: {
      id: interviewer.id,
      name: interviewer.name,
      gender: interviewer.gender,
      avatarStyle: interviewer.avatarStyle,
      voiceEnabled: Boolean(interviewer.voiceId),
    },
    transcript: answerText || "",
    question: {
      topic: aiResponse?.nextQuestion?.topic || "",
      text: nextQuestionText,
    },
    evaluation: aiResponse?.answerEvaluation || null,
    decision: aiResponse?.interviewDecision || null,
    audio: ttsAudio,
  };
}
