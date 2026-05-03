import { Router } from "express";
import authRouter from "./auth.routes.js";
import practiceRouter from "./practice.routes.js";

const indexRouter = Router();

indexRouter.use("/v1/auth", authRouter);
indexRouter.use("/v1/practice", practiceRouter);

export default indexRouter;
