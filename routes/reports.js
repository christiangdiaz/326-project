import express from "express";

import {
  showReports,
  createReport,
  removeReport,
  changeReportStatus
} from "../controllers/reportController.js";

import { requireLogin } from "../middleware/requireLogin.js";

const router = express.Router();

router.get("/", showReports);
router.get("/reports", showReports);

router.post("/reports", requireLogin, createReport);

// PATCH rather than POST: the request carries one field of an existing report,
// and repeating it is harmless, which is exactly what PATCH describes.
router.patch("/reports/:id/status", requireLogin, changeReportStatus);

router.delete("/reports/:id", requireLogin, removeReport);

export default router;
