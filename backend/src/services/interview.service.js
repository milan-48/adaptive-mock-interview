import { randomInt } from "node:crypto";
import { Interview } from "../models/Interview.js";
import { User } from "../models/User.js";
import {
  DEFAULT_INTERVIEW_DURATION_MIN,
  INTERVIEW_STATUSES,
  MAX_INTERVIEW_DURATION_MIN,
  MIN_INTERVIEW_DURATION_MIN,
} from "../constants/interview.constants.js";
import { HttpError } from "../utils/httpError.js";

const RESUME_MAX_LEN = 300000;

function sanitizeResume(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (s.length > RESUME_MAX_LEN) {
    throw new HttpError(400, "Resume payload is too large");
  }
  return s;
}

/** Google Meet–style: three groups, 10 lowercase letters (e.g. kzg-jxqc-nwp). */
function randomLowerSegment(len) {
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + randomInt(0, 26)),
  ).join("");
}

function createRoomId() {
  return `${randomLowerSegment(3)}-${randomLowerSegment(4)}-${randomLowerSegment(3)}`;
}

/**
 * Picks a room id not present in the DB, then persists the interview.
 * Uniqueness is guaranteed by the unique index on `roomId`; we pre-check with
 * `exists` and retry on duplicate-key races so a code is never stored twice.
 */
const ALLOCATE_ROOM_MAX_ATTEMPTS = 128;

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

function isDuplicateRoomIdError(err) {
  if (!err || err.code !== 11000) return false;
  if (err.keyPattern && err.keyPattern.roomId === 1) return true;
  return err.keyValue && Object.hasOwn(err.keyValue, "roomId");
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

export async function lookupInterviewByRoomForCandidate(actor, rawRoomId) {
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
    throw new HttpError(
      403,
      "This interview is not assigned to your account",
    );
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

  return { interview: toPublicInterview(doc, { includeResume: false }) };
}

function toPublicInterview(doc, { includeResume = false } = {}) {
  const o = doc.toObject ? doc.toObject() : doc;
  const candidate = o.candidateId && typeof o.candidateId === "object" ? o.candidateId : null;
  const scheduledBy =
    o.scheduledById && typeof o.scheduledById === "object" ? o.scheduledById : null;

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
    hasResume: Boolean(o.resumeUrl && String(o.resumeUrl).trim()),
    ...(includeResume ? { resumeUrl: o.resumeUrl || "" } : {}),
    yearsExperience:
      o.yearsExperience === null || o.yearsExperience === undefined
        ? null
        : Number(o.yearsExperience),
    durationMinutes: o.durationMinutes,
    status: o.status,
    suspendedReason: o.suspendedReason || "",
    reportPlaceholder: o.reportPlaceholder || "",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function createInterview(actor, body) {
  const candidateId = String(body.candidateId || "").trim();
  const interviewType = String(body.interviewType || "").trim();
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

  let yearsExperience =
    body.yearsExperience === "" || body.yearsExperience === undefined
      ? null
      : Number(body.yearsExperience);
  if (yearsExperience !== null && (Number.isNaN(yearsExperience) || yearsExperience < 0)) {
    throw new HttpError(400, "Invalid years of experience");
  }

  if (!resumeUrl) {
    if (yearsExperience === null) {
      throw new HttpError(
        400,
        "Years of experience is required when no resume is uploaded",
      );
    }
  } else {
    if (yearsExperience !== null && yearsExperience < 0) {
      throw new HttpError(400, "Invalid years of experience");
    }
  }

  const candidate = await User.findById(candidateId);
  if (!candidate || candidate.role !== "candidate") {
    throw new HttpError(400, "Invalid candidate");
  }
  if (!candidate.activeStatus) {
    throw new HttpError(400, "Candidate account is inactive");
  }

  const doc = await createInterviewDocument({
    candidateId: candidate._id,
    scheduledById: actor._id,
    interviewType,
    resumeUrl,
    yearsExperience,
    durationMinutes,
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

export async function getInterviewById(actor, interviewId) {
  const doc = await Interview.findById(interviewId)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();
  if (!doc || doc.status === "deleted") {
    throw new HttpError(404, "Interview not found");
  }
  return { interview: toPublicInterview(doc, { includeResume: true }) };
}

export async function updateInterview(actor, interviewId, body) {
  const doc = await Interview.findById(interviewId);
  if (!doc) {
    throw new HttpError(404, "Interview not found");
  }

  if (body.status !== undefined) {
    const next = String(body.status || "").trim();
    if (!INTERVIEW_STATUSES.includes(next)) {
      throw new HttpError(400, "Invalid status");
    }
    doc.status = next;
    if (next === "suspended") {
      doc.suspendedReason = String(body.suspendedReason || "").trim().slice(0, 2000);
    }
  }

  await doc.save();
  const populated = await Interview.findById(doc._id)
    .populate("candidateId", "email name avatarUrl")
    .populate("scheduledById", "email name")
    .exec();

  return { interview: toPublicInterview(populated, { includeResume: false }) };
}
