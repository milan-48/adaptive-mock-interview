import mongoose from "mongoose";
import logger from "../utils/logger.js";

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("MongoDB connection established");
}
