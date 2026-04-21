import { Router } from "express";
import * as interviewController from "../controllers/interview.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const interviewRouter = Router();

interviewRouter.post(
  "/",
  requireAuth(),
  requireRole("admin", "staff"),
  interviewController.createInterview,
);

interviewRouter.get(
  "/",
  requireAuth(),
  requireRole("admin", "staff"),
  interviewController.listInterviews,
);

interviewRouter.post(
  "/lookup-by-room",
  requireAuth(),
  requireRole("candidate"),
  interviewController.lookupInterviewByRoom,
);

interviewRouter.post(
  "/start-by-room",
  requireAuth(),
  requireRole("candidate"),
  interviewController.startInterviewByRoom,
);

interviewRouter.post(
  "/by-room/:roomId/candidate-turn",
  requireAuth(),
  requireRole("candidate"),
  interviewController.candidateTurn,
);

interviewRouter.post(
  "/by-room/:roomId/end-call",
  requireAuth(),
  requireRole("candidate"),
  interviewController.endCandidateInterviewCall,
);

interviewRouter.get(
  "/mine",
  requireAuth(),
  requireRole("candidate"),
  interviewController.listMyInterviews,
);

interviewRouter.post(
  "/:interviewId/turn-result",
  requireAuth(),
  requireRole("admin", "staff"),
  interviewController.recordInterviewTurn,
);

interviewRouter.get(
  "/:interviewId",
  requireAuth(),
  requireRole("admin", "staff"),
  interviewController.getInterview,
);

interviewRouter.patch(
  "/:interviewId",
  requireAuth(),
  requireRole("admin", "staff"),
  interviewController.updateInterview,
);

export default interviewRouter;
