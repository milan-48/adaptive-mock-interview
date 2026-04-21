import {
  getInterviewPromptTemplate,
  INTERVIEW_RESPONSE_JSON_FORMAT,
} from "../constants/interviewPrompt.constants.js";
import { DEFAULT_INTERVIEW_DIFFICULTY } from "../constants/interview.constants.js";

function toPlain(obj) {
  return obj && typeof obj.toObject === "function" ? obj.toObject() : obj || {};
}

function interviewTypeOf(interview) {
  return String(interview?.interviewType || "").trim().toLowerCase();
}

function runtimeStateOf(interview) {
  return interview?.runtimeState || {};
}

function candidateContextOf(interview) {
  return interview?.candidateContext || {};
}

function toStringArray(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : [];
}

function maxQuestionsOf(interview, template) {
  const runtime = runtimeStateOf(interview);
  const n = Number(runtime.maxQuestions || template.maxQuestions || 0);
  return Number.isFinite(n) && n > 0 ? n : template.maxQuestions;
}

export function buildCandidateContext(interviewDoc, candidateDoc) {
  const interview = toPlain(interviewDoc);
  const candidate = toPlain(candidateDoc);
  const ctx = candidateContextOf(interview);

  const years =
    ctx.yearsOfExperience ??
    interview.yearsOfExperience ??
    interview.yearsExperience ??
    null;

  return {
    candidateId: candidate?._id?.toString?.() || "",
    candidateName: candidate?.name || "",
    candidateEmail: candidate?.email || "",
    interviewType: interviewTypeOf(interview),
    yearsOfExperience: years,
    durationMinutes: Number(interview.durationMinutes || 0),
    difficulty:
      runtimeStateOf(interview).difficulty || DEFAULT_INTERVIEW_DIFFICULTY,
    resumeUrl: interview.resumeUrl || "",
    resumeSummary: ctx.resumeSummary || "",
    skills: toStringArray(ctx.skills),
    projects: toStringArray(ctx.projects),
  };
}

export function buildInterviewState(interviewDoc, templateOverride) {
  const interview = toPlain(interviewDoc);
  const runtime = runtimeStateOf(interview);
  const template =
    templateOverride || getInterviewPromptTemplate(interviewTypeOf(interview));

  return {
    currentQuestionNumber: Number(runtime.currentQuestionNumber || 0),
    maxQuestions: maxQuestionsOf(interview, template),
    askedTopics: toStringArray(runtime.askedTopics),
    runningSummary: runtime.runningSummary || "",
    lastQuestion: runtime.lastQuestion || "",
    lastCandidateAnswer: runtime.lastCandidateAnswer || "",
    warningCount: Number(runtime.warningCount || 0),
    abusiveLanguageCount: Number(runtime.abusiveLanguageCount || 0),
    cheatingSignalCount: Number(runtime.cheatingSignalCount || 0),
    quitIntentCount: Number(runtime.quitIntentCount || 0),
  };
}

export function buildInitialPromptPayload({
  interview,
  candidate,
  template,
}) {
  const templateResolved =
    template || getInterviewPromptTemplate(interviewTypeOf(interview));
  const state = buildInterviewState(interview, templateResolved);

  return {
    promptTemplateKey: templateResolved.key,
    promptVersion: `v${templateResolved.version}`,
    systemPrompt: templateResolved.systemPrompt,
    interviewConfig: {
      interviewType: interviewTypeOf(interview),
      durationMinutes: Number(interview.durationMinutes || 0),
      difficulty:
        runtimeStateOf(interview).difficulty || DEFAULT_INTERVIEW_DIFFICULTY,
      maxQuestions: state.maxQuestions,
      allowedTopics: templateResolved.allowedTopics,
    },
    candidateContext: buildCandidateContext(interview, candidate),
    interviewState: {
      ...state,
      currentQuestionNumber: 0,
      askedTopics: [],
      runningSummary: "",
      lastQuestion: "",
      lastCandidateAnswer: "",
    },
    instructions: `
Generate the first interview question.
If resume summary is missing, use years of experience.
Ask exactly one question.
Return JSON only.
    `.trim(),
  };
}

export function buildNextTurnPromptPayload({
  interview,
  candidateAnswer,
  template,
}) {
  const templateResolved =
    template || getInterviewPromptTemplate(interviewTypeOf(interview));

  return {
    promptTemplateKey: templateResolved.key,
    promptVersion: `v${templateResolved.version}`,
    systemPrompt: templateResolved.systemPrompt,
    interviewConfig: {
      interviewType: interviewTypeOf(interview),
      durationMinutes: Number(interview.durationMinutes || 0),
      difficulty:
        runtimeStateOf(interview).difficulty || DEFAULT_INTERVIEW_DIFFICULTY,
      maxQuestions: maxQuestionsOf(interview, templateResolved),
      allowedTopics: templateResolved.allowedTopics,
    },
    candidateContext: {
      resumeSummary: candidateContextOf(interview).resumeSummary || "",
      skills: toStringArray(candidateContextOf(interview).skills),
      projects: toStringArray(candidateContextOf(interview).projects),
      yearsOfExperience:
        candidateContextOf(interview).yearsOfExperience ??
        interview.yearsOfExperience ??
        interview.yearsExperience ??
        null,
    },
    interviewState: buildInterviewState(interview, templateResolved),
    latestTurn: {
      previousQuestion: runtimeStateOf(interview).lastQuestion || "",
      candidateAnswer: String(candidateAnswer || "").trim(),
    },
    instructions: `
Evaluate the candidate answer and decide next action.
Handle policy behavior strictly:
- abusive language => warn once, repeat => suspend_interview
- cheating suspicion => warn once, repeat => suspend_interview
- quit request => first resolve_quit_request, end only when quitConfirmed is true
Ask exactly one next question unless action is end_interview or suspend_interview.
Return JSON only.
    `.trim(),
  };
}

export function buildGeminiPromptText(payload) {
  return `
${payload.systemPrompt}

INTERVIEW CONFIG:
${JSON.stringify(payload.interviewConfig, null, 2)}

CANDIDATE CONTEXT:
${JSON.stringify(payload.candidateContext, null, 2)}

INTERVIEW STATE:
${JSON.stringify(payload.interviewState, null, 2)}

${payload.latestTurn ? `LATEST TURN:\n${JSON.stringify(payload.latestTurn, null, 2)}\n` : ""}

TASK:
${payload.instructions}

OUTPUT FORMAT:
${INTERVIEW_RESPONSE_JSON_FORMAT}
  `.trim();
}
