import { Router } from "express";
import * as practiceController from "../controllers/practice.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const practiceRouter = Router();

practiceRouter.post(
  "/generate-questions",
  requireAuth(),
  practiceController.generateQuestions,
);

practiceRouter.post(
  "/feedback",
  requireAuth(),
  practiceController.answerFeedback,
);

practiceRouter.post(
  "/session-summary",
  requireAuth(),
  practiceController.sessionSummary,
);

practiceRouter.get(
  "/sessions",
  requireAuth(),
  practiceController.listMySessions,
);

practiceRouter.get(
  "/sessions/:sessionId",
  requireAuth(),
  practiceController.getMySession,
);

export default practiceRouter;
