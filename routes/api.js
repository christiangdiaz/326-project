import express from "express";

import {
  getReports,
  addReport,
  deleteReport,
  updateReportStatus
} from "../services/reportService.js";

import { REPORT_STATUSES } from "../constants/reportStatus.js";
import { requireLogin } from "../middleware/requireLogin.js";

// A JSON face on the same services the HTML pages use.
//
// The board was reachable only by a browser rendering EJS, which makes it
// unusable from anything else — a phone client, a building-management system
// pushing work orders in, a script pulling open tickets out. Nothing here
// reimplements a rule: every handler calls the same service function its HTML
// counterpart calls, so validation and the ownership check cannot drift
// between the two surfaces.
//
// Writes go through the same session cookie and the same CSRF check as the
// forms do, hence GET /api/csrf for a client that needs to bootstrap a token.

const router = express.Router();

function toJson(report) {
  return {
    id: String(report._id ?? report.id),
    unit: report.unit,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

router.get("/api/csrf", (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

router.get("/api/statuses", (req, res) => {
  res.json({ statuses: REPORT_STATUSES });
});

router.get("/api/reports", async (req, res) => {
  const reports = await getReports({
    status: req.query.status,
    search: req.query.q
  });

  res.json({
    count: reports.length,
    reports: reports.map(toJson)
  });
});

router.post("/api/reports", requireLogin, async (req, res) => {
  const created = await addReport({
    unit: req.body?.unit,
    description: req.body?.description,
    ownerId: req.user.id
  });

  res
    .status(201)
    .location(`/api/reports/${created._id ?? created.id}`)
    .json({ report: toJson(created) });
});

router.patch("/api/reports/:id/status", requireLogin, async (req, res) => {
  const updated = await updateReportStatus(
    req.params.id,
    req.body?.status,
    req.user
  );

  res.json({ report: toJson(updated) });
});

router.delete("/api/reports/:id", requireLogin, async (req, res) => {
  await deleteReport(req.params.id, req.user);

  res.status(204).end();
});

export default router;
