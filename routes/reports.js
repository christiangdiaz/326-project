import express from "express";

import {
  showReports,
  createReport,
  removeReport
} from "../controllers/reportController.js";

import {
  requireLogin
} from "../middleware/requireLogin.js";

const router = express.Router();

router.get("/", showReports);
router.get("/reports", showReports);

router.post(
  "/reports",
  requireLogin,
  createReport
);

router.delete(
  "/reports/:id",
  requireLogin,
  removeReport
);

export default router;