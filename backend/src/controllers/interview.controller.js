import * as interviewService from "../services/interview.service.js";
import logger from "../utils/logger.js";
import { HttpError } from "../utils/httpError.js";

export async function createInterview(req, res) {
  try {
    const result = await interviewService.createInterview(req.user, req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Create interview failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not schedule interview" });
  }
}

export async function lookupInterviewByRoom(req, res) {
  try {
    const result = await interviewService.lookupInterviewByRoomForCandidate(
      req.user,
      req.body?.roomId,
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Lookup interview by room failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not verify room code" });
  }
}

export async function listInterviews(req, res) {
  try {
    const result = await interviewService.listInterviews(req.user, req.query);
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("List interviews failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not load interviews" });
  }
}

export async function getInterview(req, res) {
  try {
    const result = await interviewService.getInterviewById(req.user, req.params.interviewId);
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Get interview failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not load interview" });
  }
}

export async function updateInterview(req, res) {
  try {
    const result = await interviewService.updateInterview(
      req.user,
      req.params.interviewId,
      req.body,
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error("Update interview failed", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Could not update interview" });
  }
}
