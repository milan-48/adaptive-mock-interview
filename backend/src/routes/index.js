import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";

const indexRouter = Router();

indexRouter.use("/v1/auth", authRouter);
indexRouter.use("/v1/health", healthRouter);

export default indexRouter;
