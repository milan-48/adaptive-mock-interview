import mongoose from "mongoose";
import {
  DEFAULT_INTERVIEW_DIFFICULTY,
  INTERVIEW_STATUSES,
  INTERVIEW_DIFFICULTY_LEVELS,
  DEFAULT_INTERVIEW_DURATION_MIN,
  MIN_INTERVIEW_DURATION_MIN,
  MAX_INTERVIEW_DURATION_MIN,
} from "../constants/interview.constants.js";

const candidateContextSchema = new mongoose.Schema(
  {
    resumeSummary: { type: String, default: "", trim: true },
    skills: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    yearsOfExperience: { type: Number, min: 0, max: 80, default: null },
  },
  { _id: false },
);

const integrityEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    severity: { type: String, default: "info", trim: true },
    note: { type: String, default: "", trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const runtimeStateSchema = new mongoose.Schema(
  {
    difficulty: {
      type: String,
      enum: INTERVIEW_DIFFICULTY_LEVELS,
      default: DEFAULT_INTERVIEW_DIFFICULTY,
    },
    currentQuestionNumber: { type: Number, min: 0, default: 0 },
    maxQuestions: { type: Number, min: 1, max: 50, default: 8 },
    askedTopics: { type: [String], default: [] },
    runningSummary: { type: String, default: "", trim: true },
    lastQuestion: { type: String, default: "", trim: true },
    lastCandidateAnswer: { type: String, default: "", trim: true },
    warningCount: { type: Number, min: 0, default: 0 },
    abusiveLanguageCount: { type: Number, min: 0, default: 0 },
    cheatingSignalCount: { type: Number, min: 0, default: 0 },
    quitIntentCount: { type: Number, min: 0, default: 0 },
    integrityEvents: { type: [integrityEventSchema], default: [] },
    initialPromptPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    currentPromptPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    startedAt: { type: Date, default: null },
    promptGeneratedAt: { type: Date, default: null },
  },
  { _id: false },
);

const interviewSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scheduledById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    interviewType: {
      type: String,
      required: true,
      trim: true,
    },
    /** Stable identifier of the selected base prompt template (e.g., technical_v1). */
    basePromptKey: { type: String, required: true, trim: true, default: "technical_v1" },
    /** Version from interview_prompt_templates collection. */
    basePromptVersion: { type: Number, required: true, min: 1, default: 1 },
    /** Optional resume (e.g. data URL or stored text reference for demo). */
    resumeUrl: { type: String, default: "" },
    /** Required when no resume (years in the field they are interviewing for). */
    yearsExperience: { type: Number, min: 0, max: 80, default: null },
    /** Alias kept for prompt/candidate context consumers. */
    yearsOfExperience: { type: Number, min: 0, max: 80, default: null },
    durationMinutes: {
      type: Number,
      default: DEFAULT_INTERVIEW_DURATION_MIN,
      min: MIN_INTERVIEW_DURATION_MIN,
      max: MAX_INTERVIEW_DURATION_MIN,
    },
    candidateContext: { type: candidateContextSchema, default: () => ({}) },
    runtimeState: { type: runtimeStateSchema, default: () => ({}) },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: "scheduled",
      index: true,
    },
    /** Reserved for future summary / report generation. */
    reportPlaceholder: { type: String, default: "" },
    suspendedReason: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export const Interview =
  mongoose.models.Interview || mongoose.model("Interview", interviewSchema);
