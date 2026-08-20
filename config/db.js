import mongoose from "mongoose";

import { config } from "./env.js";
import { logger } from "../lib/logger.js";

export async function connectDB(uri = config.mongoUri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    logger.info("connected to MongoDB", { uri });
  } catch (error) {
    logger.error("could not connect to MongoDB", { uri, error });

    // Kept as plain text alongside the structured log: this is the failure a
    // new contributor hits on their first clone, and the fix belongs on the
    // screen rather than in a log field.
    console.error("\nCould not connect to MongoDB.");
    console.error(`  Tried: ${uri}`);
    console.error("  Start one with Docker:");
    console.error("    docker compose up -d mongo");
    console.error("  Or set MONGODB_URI to your own connection string.\n");

    process.exit(1);
  }
}
