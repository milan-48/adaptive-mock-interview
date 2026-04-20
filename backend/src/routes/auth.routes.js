import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/me", requireAuth(), authController.me);
authRouter.get(
  "/admin/ping",
  requireAuth(),
  requireRole("admin", "staff"),
  authController.adminPing,
);

authRouter.get(
  "/users",
  requireAuth(),
  requireRole("admin", "staff"),
  authController.listUsers,
);

authRouter.post(
  "/users",
  requireAuth(),
  requireRole("admin", "staff"),
  authController.createPrivilegedUser,
);

export default authRouter;
