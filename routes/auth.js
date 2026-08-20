import express from "express";

import {
  signup,
  login,
  logout
} from "../controllers/authController.js";

import { createRateLimiter, loginKey } from "../middleware/rateLimit.js";

const router = express.Router();

// Credential endpoints are the ones worth throttling: every request here is a
// bcrypt comparison, and an unlimited one is both a guessing oracle and a way
// to saturate the event loop. Signup gets a looser limit than login because a
// real person signs up once.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFor: loginKey,
  message:
    "Too many login attempts. Please wait a few minutes and try again."
});

const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many sign-up attempts. Please try again later."
});

router.get("/login", (req, res) => {
  res.render("auth", {
    error: null,
    errorForm: null,
    email: "",
    signedUp: req.query.signedUp === "1"
  });
});

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

export default router;
