/** Lifecycle of a scheduled interview (admin-visible labels can differ in UI). */
export const INTERVIEW_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "suspended",
  "deleted",
];

export const DEFAULT_INTERVIEW_DURATION_MIN = 15;
export const MIN_INTERVIEW_DURATION_MIN = 5;
export const MAX_INTERVIEW_DURATION_MIN = 180;

/** Suggested types; API accepts any non-empty string for flexibility. */
export const INTERVIEW_TYPE_PRESETS = [
  "technical",
  "behavioral",
  "system_design",
  "mixed",
  "other",
];
