import express from "express";
import {
  showReports,
  createReport,
  removeReport
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/", showReports);
router.get("/reports", showReports);
router.post("/reports", createReport);
router.delete("/reports/:id", removeReport);

export default router;