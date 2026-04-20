import "dotenv/config";
import { createApp } from "./src/app.js";
import logger from "./src/utils/logger.js";

const port = Number(process.env.PORT) || 3001;

async function start() {
  try {
    const app = await createApp();
    app.listen(port, () => {
      logger.info(`API listening on http://localhost:${port}`);
    });
  } catch (err) {
    logger.error("Server failed to start", { message: err.message });
    process.exit(1);
  }
}

start();
