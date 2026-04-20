import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [
    new winston.transports.Console({
      format: isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, ...meta }) => {
              const rest = Object.keys(meta).length
                ? ` ${JSON.stringify(meta)}`
                : "";
              return `${level}: ${message}${rest}`;
            }),
          )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
    }),
  ],
});

export default logger;
