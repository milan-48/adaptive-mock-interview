import mongoose from "mongoose";
import { INTERVIEW_TYPE_PRESETS } from "../constants/interview.constants.js";

const interviewPromptTemplateSchema = new mongoose.Schema(
  {
    interviewType: {
      type: String,
      required: true,
      enum: INTERVIEW_TYPE_PRESETS,
      index: true,
      trim: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    systemPrompt: {
      type: String,
      required: true,
      trim: true,
    },
    /** Backward compatibility with older docs; prefer systemPrompt. */
    template: { type: String, default: "", trim: true },
    maxQuestions: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      default: 8,
    },
    allowedTopics: { type: [String], default: [] },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

interviewPromptTemplateSchema.index(
  { interviewType: 1, version: 1 },
  { unique: true },
);
interviewPromptTemplateSchema.index({ key: 1 }, { unique: true });

export const InterviewPromptTemplate =
  mongoose.models.InterviewPromptTemplate ||
  mongoose.model("InterviewPromptTemplate", interviewPromptTemplateSchema);
