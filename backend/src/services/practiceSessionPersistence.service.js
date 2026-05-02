import mongoose from "mongoose";
import { PracticeSession } from "../models/PracticeSession.js";
import { HttpError } from "../utils/httpError.js";

const TYPES = new Set(["technical", "behavioral", "system_design"]);

function sanitizeText(value, maxLen) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeType(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return TYPES.has(t) ? t : "";
}

function parseYears(raw) {
  if (raw === "" || raw === undefined || raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > 60) return null;
  return n;
}

function sanitizeFeedback(pf) {
  if (!pf || typeof pf !== "object") return null;
  const strengths = Array.isArray(pf.strengths)
    ? pf.strengths.map((s) => sanitizeText(s, 400)).filter(Boolean)
    : [];
  const improvements = Array.isArray(pf.improvements)
    ? pf.improvements.map((s) => sanitizeText(s, 400)).filter(Boolean)
    : [];
  const followUpSuggestions = Array.isArray(pf.followUpSuggestions)
    ? pf.followUpSuggestions.map((s) => sanitizeText(s, 400)).filter(Boolean)
    : [];
  const signalsDetected = Array.isArray(pf.signalsDetected)
    ? pf.signalsDetected.map((s) => sanitizeText(s, 400)).filter(Boolean).slice(0, 12)
    : [];
  const missingOrUnclear = Array.isArray(pf.missingOrUnclear)
    ? pf.missingOrUnclear.map((s) => sanitizeText(s, 400)).filter(Boolean).slice(0, 8)
    : [];
  const substance = Math.max(
    0,
    Math.min(100, Math.round(Number(pf.substanceScoreOutOf100) || 0)),
  );
  return {
    summary: sanitizeText(pf.summary, 4000),
    substanceScoreOutOf100: substance,
    signalsDetected,
    missingOrUnclear,
    strengths,
    improvements,
    followUpSuggestions,
  };
}

/**
 * Persist a completed practice session (call after AI summary succeeds).
 */
export async function saveCompletedSession(userId, body, result) {
  const interviewType = normalizeType(body?.interviewType);
  if (!interviewType) {
    throw new HttpError(400, "Invalid interviewType");
  }
  const yearsExperience = parseYears(body?.yearsExperience);
  if (yearsExperience === null) {
    throw new HttpError(400, "Invalid yearsExperience");
  }
  const resumeText = sanitizeText(body?.resumeText, 12000);
  const rawTurns = Array.isArray(body?.turns) ? body.turns : [];
  if (rawTurns.length < 1) {
    throw new HttpError(400, "No turns to save");
  }

  const turns = rawTurns.map((t) => ({
    question: sanitizeText(t?.question, 4000),
    answer: sanitizeText(t?.answer, 12000),
    perQuestionFeedback: sanitizeFeedback(t?.perQuestionFeedback),
  }));

  for (const t of turns) {
    if (!t.question || !t.answer) {
      throw new HttpError(400, "Each turn needs question and answer");
    }
  }
  const aiScores = turns
    .map((t) => Number(t?.perQuestionFeedback?.substanceScoreOutOf100))
    .filter((n) => Number.isFinite(n));
  const aiDetectedPercent = aiScores.length
    ? Math.round(aiScores.reduce((sum, n) => sum + n, 0) / aiScores.length)
    : null;
  const scoreOutOf100 = Math.max(0, Math.min(100, Number(result?.scoreOutOf100) || 0));
  const failReasons = [];
  if (aiDetectedPercent !== null && aiDetectedPercent > 50) {
    failReasons.push(
      `AI detected in answers is ${aiDetectedPercent}% (must be 50% or below).`,
    );
  }
  if (scoreOutOf100 <= 75) {
    failReasons.push(`Session score is ${scoreOutOf100}/100 (must be above 75).`);
  }
  const passStatus = failReasons.length === 0 ? "Passed" : "Failed";

  const doc = await PracticeSession.create({
    user: new mongoose.Types.ObjectId(String(userId)),
    interviewType,
    yearsExperience,
    resumeText,
    questionCount: turns.length,
    turns,
    result: {
      overallSummary: sanitizeText(result?.overallSummary, 8000),
      scoreOutOf100,
      aiDetectedPercent,
      passStatus,
      failReasons,
      interviewReadinessScore: Math.max(
        0,
        Math.min(100, Math.round(Number(result?.interviewReadinessScore) || 0)),
      ),
      interviewReadinessSummary: sanitizeText(result?.interviewReadinessSummary, 4000),
      suitableRoles: Array.isArray(result?.suitableRoles)
        ? result.suitableRoles.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 10)
        : [],
      roleFitSummary: sanitizeText(result?.roleFitSummary, 4000),
      topStrengths: Array.isArray(result?.topStrengths)
        ? result.topStrengths.map((s) => sanitizeText(s, 500)).filter(Boolean)
        : [],
      priorityImprovements: Array.isArray(result?.priorityImprovements)
        ? result.priorityImprovements.map((s) => sanitizeText(s, 500)).filter(Boolean)
        : [],
      nextPracticeFocus: Array.isArray(result?.nextPracticeFocus)
        ? result.nextPracticeFocus.map((s) => sanitizeText(s, 500)).filter(Boolean)
        : [],
    },
  });

  return doc;
}

export async function listSessionsForUser(userId, { limit = 50 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const rows = await PracticeSession.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(cap)
    .select(
      "interviewType yearsExperience result.scoreOutOf100 result.aiDetectedPercent result.passStatus result.failReasons questionCount createdAt",
    )
    .lean();

  return rows.map((s) => ({
    id: String(s._id),
    createdAt: s.createdAt,
    interviewType: s.interviewType,
    yearsExperience: s.yearsExperience,
    scoreOutOf100: s.result?.scoreOutOf100 ?? 0,
    aiDetectedPercent: s.result?.aiDetectedPercent ?? null,
    passStatus:
      s.result?.passStatus ||
      (s.result?.aiDetectedPercent != null && Number(s.result.aiDetectedPercent) > 50
        ? "Failed"
        : Number(s.result?.scoreOutOf100 || 0) > 75
          ? "Passed"
          : "Failed"),
    failReasons: Array.isArray(s.result?.failReasons) ? s.result.failReasons : [],
    questionCount: s.questionCount ?? 0,
  }));
}

export async function getSessionForUser(userId, sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) {
    return null;
  }
  const doc = await PracticeSession.findOne({
    _id: sessionId,
    user: userId,
  }).lean();

  if (!doc) return null;

  return {
    id: String(doc._id),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    interviewType: doc.interviewType,
    yearsExperience: doc.yearsExperience,
    resumeText: doc.resumeText || "",
    turns: doc.turns || [],
    result: doc.result,
  };
}
