import * as practiceService from "../services/practiceInterview.service.js";
import * as practiceSessionPersistence from "../services/practiceSessionPersistence.service.js";
import { HttpError } from "../utils/httpError.js";
import logger from "../utils/logger.js";

export async function generateQuestions(req, res) {
  try {
    const result = await practiceService.generatePracticeQuestions(req.body);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Practice generate questions failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not generate questions" });
  }
}

export async function answerFeedback(req, res) {
  try {
    const result = await practiceService.practiceAnswerFeedback(req.body);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Practice feedback failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not generate feedback" });
  }
}

export async function sessionSummary(req, res) {
  try {
    const finished = await practiceService.completePracticeSession(req.body);
    const { turns, ...sessionPayload } = finished;
    const persistBody = { ...req.body, turns };
    let sessionId = null;
    try {
      const saved = await practiceSessionPersistence.saveCompletedSession(
        req.user._id,
        persistBody,
        sessionPayload,
      );
      sessionId = saved._id.toString();
    } catch (persistErr) {
      logger.error("Practice session save failed", {
        message: persistErr.message,
        stack: persistErr.stack,
      });
    }
    return res.status(200).json({ ...sessionPayload, turns, sessionId });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Practice session summary failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not generate session summary" });
  }
}

export async function listMySessions(req, res) {
  try {
    const limit = req.query?.limit ? Number(req.query.limit) : 50;
    const sessions = await practiceSessionPersistence.listSessionsForUser(
      req.user._id,
      { limit },
    );
    return res.status(200).json({ sessions });
  } catch (err) {
    logger.error("List practice sessions failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not load practice history" });
  }
}

export async function getMySession(req, res) {
  try {
    const session = await practiceSessionPersistence.getSessionForUser(
      req.user._id,
      req.params.sessionId,
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.status(200).json(session);
  } catch (err) {
    logger.error("Get practice session failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not load session" });
  }
}
