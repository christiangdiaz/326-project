import express from "express";

import {
  signup,
  login,
  logout
} from "../controllers/authController.js";

const router = express.Router();

router.get("/login", (req, res) => {
  res.render("auth", {
    error: null,
    errorForm: null,
    email: "",
    signedUp: req.query.signedUp === "1"
  });
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

export default router;