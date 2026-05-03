import express from "express";
import cors from "cors";
import indexRouter from "./routes/index.js";
import healthRouter from "./routes/health.routes.js";
import { connect } from "./config/database.js";
import { requestLogger } from "./middlewares/requestLogger.middleware.js";
import logger from "./utils/logger.js";

function parseAllowedOrigins() {
  const raw =
    String(process.env.CORS_ORIGINS || "").trim() ||
    String(process.env.CORS_ORIGIN || "").trim();
  const defaults = ["http://localhost:3000", "http://127.0.0.1:3000"];
  const list = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : defaults;
  return [...new Set(list)];
}

export async function createApp() {
  const app = express();

  const allowed = parseAllowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        return callback(null, allowed.includes(origin));
      },
      credentials: true,
      optionsSuccessStatus: 200,
    }),
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: "50mb",
      parameterLimit: 50000,
    }),
  );
  app.use(requestLogger);

  /** Liveness: must not depend on Mongo (Vercel health checks, debugging). */
  app.use("/v1/health", healthRouter);

  /** DB required for all API routes except health (avoid crashing serverless cold starts). */
  app.use(async (req, res, next) => {
    if (req.path === "/v1/health" || req.path.startsWith("/v1/health/")) {
      return next();
    }
    try {
      await connect();
      return next();
    } catch (err) {
      logger.error("Database connection failed", {
        message: err.message,
        stack: err.stack,
      });
      return res.status(503).json({
        error:
          "Database unavailable. Set MONGODB_URI on the server (check Vercel env vars).",
      });
    }
  });

  app.use("/", indexRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err, _req, res, _next) => {
    logger.error("Unhandled error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
