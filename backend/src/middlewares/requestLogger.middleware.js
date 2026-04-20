import logger from "../utils/logger.js";

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("HTTP", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
}
