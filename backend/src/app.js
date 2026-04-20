import express from "express";
import cors from "cors";
import indexRouter from "./routes/index.js";
import { connect } from "./config/database.js";
import { requestLogger } from "./middlewares/requestLogger.middleware.js";
import logger from "./utils/logger.js";

export async function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
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

  await connect();

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
