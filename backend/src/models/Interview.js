import mongoose from "mongoose";
import {
  INTERVIEW_STATUSES,
  DEFAULT_INTERVIEW_DURATION_MIN,
  MIN_INTERVIEW_DURATION_MIN,
  MAX_INTERVIEW_DURATION_MIN,
} from "../constants/interview.constants.js";

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
    /** Optional resume (e.g. data URL or stored text reference for demo). */
    resumeUrl: { type: String, default: "" },
    /** Required when no resume (years in the field they are interviewing for). */
    yearsExperience: { type: Number, min: 0, max: 80, default: null },
    durationMinutes: {
      type: Number,
      default: DEFAULT_INTERVIEW_DURATION_MIN,
      min: MIN_INTERVIEW_DURATION_MIN,
      max: MAX_INTERVIEW_DURATION_MIN,
    },
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
