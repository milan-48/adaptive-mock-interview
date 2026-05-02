import mongoose from "mongoose";

const turnSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    perQuestionFeedback: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema(
  {
    overallSummary: { type: String, default: "" },
    scoreOutOf100: { type: Number, required: true },
    aiDetectedPercent: { type: Number, default: null },
    passStatus: { type: String, enum: ["Passed", "Failed"], default: "Failed" },
    failReasons: { type: [String], default: [] },
    interviewReadinessScore: { type: Number, default: 0 },
    interviewReadinessSummary: { type: String, default: "" },
    suitableRoles: { type: [String], default: [] },
    roleFitSummary: { type: String, default: "" },
    topStrengths: { type: [String], default: [] },
    priorityImprovements: { type: [String], default: [] },
    nextPracticeFocus: { type: [String], default: [] },
  },
  { _id: false },
);

const practiceSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    interviewType: { type: String, required: true },
    yearsExperience: { type: Number, required: true },
    resumeText: { type: String, default: "" },
    questionCount: { type: Number, required: true },
    turns: { type: [turnSchema], required: true },
    result: { type: resultSchema, required: true },
  },
  { timestamps: true },
);

practiceSessionSchema.index({ user: 1, createdAt: -1 });

export const PracticeSession =
  mongoose.models.PracticeSession ||
  mongoose.model("PracticeSession", practiceSessionSchema);
