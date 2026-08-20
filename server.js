import mongoose from "mongoose";

import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { logger } from "./lib/logger.js";
import { startSessionSweeper } from "./sessions.js";

// Process lifecycle only: build the app, connect the database, open the
// socket, and put all three back down again cleanly. Everything about *what*
// the app does lives in app.js.

await connectDB(config.mongoUri);

const app = createApp({ config });
const stopSweeper = startSessionSweeper();

const server = app.listen(config.port, () => {
  logger.info("server listening", {
    url: `http://localhost:${config.port}`,
    env: config.nodeEnv
  });
});

// Without this, a container stop kills the process mid-request: in-flight
// responses are cut off and the Mongo connection is dropped rather than
// closed. server.close() stops accepting new connections and waits for the
// ones in progress.
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  logger.info("shutting down", { signal });

  stopSweeper();

  const forced = setTimeout(() => {
    logger.error("shutdown timed out, exiting");
    process.exit(1);
  }, 10000);

  forced.unref();

  try {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );

    await mongoose.connection.close();

    logger.info("shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("shutdown failed", { error });
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// A rejection nobody handled has already left the app in a state it did not
// plan for. Log it loudly and let the supervisor restart a clean process
// rather than serve from a half-broken one.
process.on("unhandledRejection", (error) => {
  logger.error("unhandled rejection", { error });
  shutdown("unhandledRejection");
});
