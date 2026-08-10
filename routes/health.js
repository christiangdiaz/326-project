import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// No requireLogin, deliberately. A monitoring tool polling this route has no
// session and never will; a health check that demands one can only report on
// the caller's credentials, not on whether the app is actually alive.
router.get("/health", (req, res) => {
  // readyState 1 === connected. connectDB exits the process if the *first*
  // connect fails, so the case this actually catches is MongoDB dropping out
  // from under a server that is still accepting requests.
  const databaseUp = mongoose.connection.readyState === 1;

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? "ok" : "degraded",
    database: databaseUp ? "connected" : "disconnected",
    uptime: Math.floor(process.uptime())
  });
});

export default router;
