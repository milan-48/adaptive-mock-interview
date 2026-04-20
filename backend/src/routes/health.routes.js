import { Router } from "express";
import * as healthController from "../controllers/health.controller.js";

const healthRouter = Router();

healthRouter.get("/", healthController.health);

export default healthRouter;
