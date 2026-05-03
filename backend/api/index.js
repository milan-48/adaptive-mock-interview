import "dotenv/config";
import { createApp } from "../src/app.js";

let appPromise = null;

export default async function handler(req, res) {
  try {
    if (!appPromise) {
      appPromise = createApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error("Vercel handler failed during createApp", err);
    res.status(500).json({
      error:
        err?.message ||
        "Server failed to start. Check Vercel Function logs and environment variables.",
    });
  }
}
