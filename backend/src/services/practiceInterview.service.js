import { HttpError } from "../utils/httpError.js";
import { callGeminiForJson } from "../utils/geminiJson.js";

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
  if (Number.isNaN(n) || n < 0 || n > 60) {
    throw new HttpError(400, "yearsOfExperience must be between 0 and 60");
  }
  return n;
}

export async function generatePracticeQuestions(body) {
  const interviewType = normalizeType(body?.interviewType);
  if (!interviewType) {
    throw new HttpError(
      400,
      "interviewType must be technical, behavioral, or system_design",
    );
  }
  const yearsExperience = parseYears(body?.yearsExperience);
  if (yearsExperience === null) {
    throw new HttpError(400, "yearsOfExperience is required");
  }
  const resumeText = sanitizeText(body?.resumeText, 12000);

  const typeLabel =
    interviewType === "system_design"
      ? "system design"
      : interviewType === "behavioral"
        ? "behavioral"
        : "technical";

  const prompt = `
You are an expert interviewer. Generate exactly 5 distinct interview questions for a mock interview.

Interview focus: ${typeLabel}
Candidate years of experience in this area: ${yearsExperience}
${resumeText ? `Optional resume / background (use to tailor depth, not to invent facts):\n${resumeText}\n` : ""}

Rules:
- Return JSON only, no markdown.
- Questions should match experience level (junior for low years, deeper for senior).
- For system_design, focus on requirements, APIs, data, scale, tradeoffs.
- For behavioral, use realistic workplace scenarios; one question may ask for STAR-style detail.
- For technical, mix conceptual and practical; avoid trivia unless relevant.

Shape:
{ "questions": [ { "text": "question 1" }, ... ] }

Exactly 5 items in "questions". Each "text" must be a single clear question string.
`.trim();

  const data = await callGeminiForJson(prompt);
  const list = Array.isArray(data?.questions) ? data.questions : [];
  const texts = list
    .map((q) => sanitizeText(q?.text, 2000))
    .filter(Boolean)
    .slice(0, 5);

  if (texts.length < 5) {
    throw new HttpError(502, "Could not generate 5 questions; try again");
  }

  return {
    interviewType,
    yearsExperience,
    questions: texts.map((text, i) => ({ id: i + 1, text })),
  };
}

export async function practiceAnswerFeedback(body) {
  const interviewType = normalizeType(body?.interviewType);
  if (!interviewType) {
    throw new HttpError(
      400,
      "interviewType must be technical, behavioral, or system_design",
    );
  }
  const yearsExperience = parseYears(body?.yearsExperience);
  if (yearsExperience === null) {
    throw new HttpError(400, "yearsOfExperience is required");
  }
  const resumeText = sanitizeText(body?.resumeText, 12000);
  const question = sanitizeText(body?.question, 4000);
  const answer = sanitizeText(body?.answer, 12000);

  if (!question) {
    throw new HttpError(400, "question is required");
  }
  if (!answer) {
    throw new HttpError(400, "answer is required");
  }

  const typeLabel =
    interviewType === "system_design"
      ? "system design"
      : interviewType === "behavioral"
        ? "behavioral"
        : "technical";

  const prompt = `
You are a supportive interview coach. The candidate answered one mock interview question in text.

Interview type: ${typeLabel}
Years of experience (context): ${yearsExperience}
${resumeText ? `Background note (optional):\n${resumeText}\n` : ""}

Question:
${question}

Candidate answer:
${answer}

Return JSON only:
{
  "summary": "2-4 sentences overall feedback",
  "substanceScoreOutOf100": 0,
  "signalsDetected": [
    "Concrete signal or theme you actually see in their answer (or 'Little substantive detail — answer very short' if applicable)"
  ],
  "missingOrUnclear": [
    "What was missing, vague, or not demonstrated (empty array if answer is strong)"
  ],
  "strengths": ["short bullet", "..."],
  "improvements": ["short bullet", "..."],
  "followUpSuggestions": [
    "A follow-up question or angle they could explore next",
    "Another improvement angle or deeper topic"
  ]
}

substanceScoreOutOf100: integer 0-100 = how much relevant substance, structure, and depth you can detect vs. what the question asks (not grammar). "I don't know" / empty evasion → low single digits.
signalsDetected: 2-6 items; only claim what is supported by the answer text.
Be specific and actionable. Do not invent resume facts.
`.trim();

  const data = await callGeminiForJson(prompt);
  const substance = Math.max(
    0,
    Math.min(100, Math.round(Number(data?.substanceScoreOutOf100) || 0)),
  );
  return {
    summary: sanitizeText(data?.summary, 4000),
    substanceScoreOutOf100: substance,
    signalsDetected: Array.isArray(data?.signalsDetected)
      ? data.signalsDetected.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 12)
      : [],
    missingOrUnclear: Array.isArray(data?.missingOrUnclear)
      ? data.missingOrUnclear.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 8)
      : [],
    strengths: Array.isArray(data?.strengths)
      ? data.strengths.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 8)
      : [],
    improvements: Array.isArray(data?.improvements)
      ? data.improvements.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 8)
      : [],
    followUpSuggestions: Array.isArray(data?.followUpSuggestions)
      ? data.followUpSuggestions
          .map((s) => sanitizeText(s, 800))
          .filter(Boolean)
          .slice(0, 6)
      : [],
  };
}

function turnNeedsFeedback(pf) {
  if (!pf || typeof pf !== "object") return true;
  if (!sanitizeText(pf.summary, 1)) return true;
  return false;
}

/**
 * Ensures every turn has per-question feedback (generates missing via AI), then produces session summary + returns enriched turns.
 */
export async function completePracticeSession(body) {
  const interviewType = normalizeType(body?.interviewType);
  if (!interviewType) {
    throw new HttpError(
      400,
      "interviewType must be technical, behavioral, or system_design",
    );
  }
  const yearsExperience = parseYears(body?.yearsExperience);
  if (yearsExperience === null) {
    throw new HttpError(400, "yearsOfExperience is required");
  }
  const rawTurns = Array.isArray(body?.turns) ? body.turns : [];
  if (rawTurns.length < 1) {
    throw new HttpError(400, "turns must include at least one completed question");
  }
  if (rawTurns.length > 8) {
    throw new HttpError(400, "too many turns");
  }

  const enrichedTurns = [];
  for (const t of rawTurns) {
    const question = sanitizeText(t?.question, 4000);
    const answer = sanitizeText(t?.answer, 12000);
    if (!question || !answer) {
      throw new HttpError(400, "Each turn needs question and answer");
    }
    let pf = t?.perQuestionFeedback;
    if (turnNeedsFeedback(pf)) {
      pf = await practiceAnswerFeedback({
        interviewType,
        yearsExperience,
        resumeText: body?.resumeText,
        question,
        answer,
      });
    }
    enrichedTurns.push({ question, answer, perQuestionFeedback: pf });
  }

  const sessionResult = await practiceSessionSummary({
    ...body,
    turns: enrichedTurns,
  });
  return { ...sessionResult, turns: enrichedTurns };
}

/**
 * Overall session result from all questions, answers, and per-question feedback.
 */
export async function practiceSessionSummary(body) {
  const interviewType = normalizeType(body?.interviewType);
  if (!interviewType) {
    throw new HttpError(
      400,
      "interviewType must be technical, behavioral, or system_design",
    );
  }
  const yearsExperience = parseYears(body?.yearsExperience);
  if (yearsExperience === null) {
    throw new HttpError(400, "yearsOfExperience is required");
  }
  const resumeText = sanitizeText(body?.resumeText, 12000);
  const rawTurns = Array.isArray(body?.turns) ? body.turns : [];

  if (rawTurns.length < 1) {
    throw new HttpError(400, "turns must include at least one completed question");
  }
  if (rawTurns.length > 8) {
    throw new HttpError(400, "too many turns");
  }

  const turns = rawTurns.map((t, idx) => {
    const question = sanitizeText(t?.question, 4000);
    const answer = sanitizeText(t?.answer, 12000);
    const pf = t?.perQuestionFeedback;
    const pqSummary = sanitizeText(pf?.summary, 4000);
    const pqStrengths = Array.isArray(pf?.strengths)
      ? pf.strengths.map((s) => sanitizeText(s, 400)).filter(Boolean)
      : [];
    const pqImprovements = Array.isArray(pf?.improvements)
      ? pf.improvements.map((s) => sanitizeText(s, 400)).filter(Boolean)
      : [];
    const substance = Math.max(
      0,
      Math.min(100, Math.round(Number(pf?.substanceScoreOutOf100) || 0)),
    );
    const signals = Array.isArray(pf?.signalsDetected)
      ? pf.signalsDetected.map((s) => sanitizeText(s, 400)).filter(Boolean)
      : [];
    return {
      index: idx + 1,
      question,
      answer,
      perQuestionSummary: pqSummary,
      perQuestionStrengths: pqStrengths,
      perQuestionImprovements: pqImprovements,
      substanceScoreOutOf100: substance,
      signalsDetected: signals,
    };
  });

  for (const t of turns) {
    if (!t.question || !t.answer) {
      throw new HttpError(400, "Each turn needs question and answer");
    }
  }

  const typeLabel =
    interviewType === "system_design"
      ? "system design"
      : interviewType === "behavioral"
        ? "behavioral"
        : "technical";

  const turnsBlock = turns
    .map(
      (t) => `
--- Question ${t.index} ---
Q: ${t.question}
A: ${t.answer}
Per-answer substance score (0-100, from coach): ${t.substanceScoreOutOf100}
${t.signalsDetected.length ? `Signals detected in answer: ${t.signalsDetected.join("; ")}` : ""}
${t.perQuestionSummary ? `Prior per-question coach note: ${t.perQuestionSummary}` : ""}
${t.perQuestionStrengths.length ? `Prior strengths noted: ${t.perQuestionStrengths.join("; ")}` : ""}
${t.perQuestionImprovements.length ? `Prior improvements noted: ${t.perQuestionImprovements.join("; ")}` : ""}
`.trim(),
    )
    .join("\n\n");

  const prompt = `
You are a senior interview coach. The candidate completed a full mock session (${turns.length} questions) in text.

Interview type: ${typeLabel}
Years of experience (context): ${yearsExperience}
${resumeText ? `Background (optional):\n${resumeText}\n` : ""}

Full session (questions, answers, and any per-question feedback already given):
${turnsBlock}

Return JSON only:
{
  "overallSummary": "4-8 sentences: how they did across the session, patterns, and encouragement",
  "scoreOutOf100": 0,
  "interviewReadinessScore": 0,
  "interviewReadinessSummary": "3-6 sentences: realistic readiness for real ${typeLabel} interviews at about their stated experience; what would still fail or impress an interviewer",
  "suitableRoles": [
    "Role title (level) — one short reason grounded in their answers",
    "Another plausible role if applicable, or say if answers are too thin to recommend specific roles"
  ],
  "roleFitSummary": "2-5 sentences: which kinds of roles fit now vs. after more practice; tie to answer patterns only",
  "topStrengths": ["3-5 bullets across the whole session"],
  "priorityImprovements": ["3-5 concrete bullets to focus on next"],
  "nextPracticeFocus": ["2-4 specific topics or skills to drill before next interview"]
}

scoreOutOf100: integer 0-100 for overall answer quality this session.
interviewReadinessScore: integer 0-100 separately for how ready they are to interview (communication, depth, structure); can differ from scoreOutOf100.
Do not invent resume or employer facts; infer roles only from answer content and interview type.
`.trim();

  const data = await callGeminiForJson(prompt);
  const score = Math.max(
    0,
    Math.min(100, Math.round(Number(data?.scoreOutOf100) || 0)),
  );
  const readiness = Math.max(
    0,
    Math.min(100, Math.round(Number(data?.interviewReadinessScore) || 0)),
  );

  return {
    overallSummary: sanitizeText(data?.overallSummary, 8000),
    scoreOutOf100: score,
    interviewReadinessScore: readiness,
    interviewReadinessSummary: sanitizeText(data?.interviewReadinessSummary, 4000),
    suitableRoles: Array.isArray(data?.suitableRoles)
      ? data.suitableRoles.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 10)
      : [],
    roleFitSummary: sanitizeText(data?.roleFitSummary, 4000),
    topStrengths: Array.isArray(data?.topStrengths)
      ? data.topStrengths.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 8)
      : [],
    priorityImprovements: Array.isArray(data?.priorityImprovements)
      ? data.priorityImprovements.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 8)
      : [],
    nextPracticeFocus: Array.isArray(data?.nextPracticeFocus)
      ? data.nextPracticeFocus.map((s) => sanitizeText(s, 500)).filter(Boolean).slice(0, 8)
      : [],
  };
}
