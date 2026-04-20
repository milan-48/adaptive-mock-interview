import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";
import interviewRouter from "./interview.routes.js";

const indexRouter = Router();

indexRouter.use("/v1/auth", authRouter);
indexRouter.use("/v1/health", healthRouter);
indexRouter.use("/v1/interviews", interviewRouter);

export default indexRouter;
