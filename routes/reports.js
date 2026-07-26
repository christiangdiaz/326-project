import express from "express";
import {
  showReports,
  createReport
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/", showReports);
router.get("/reports", showReports);
router.post("/reports", createReport);

export default router;