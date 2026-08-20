import {
  getReports,
  addReport,
  deleteReport,
  updateReportStatus
} from "../services/reportService.js";

import { REPORT_STATUSES } from "../constants/reportStatus.js";

// The board is readable without an account, so the filter state has to survive
// in the URL rather than in a session: a filtered view stays linkable.
function readFilters(req) {
  const status = REPORT_STATUSES.includes(req.query.status)
    ? req.query.status
    : "";

  const search =
    typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";

  return { status, search };
}

async function renderBoard(req, res, { status: httpStatus = 200, error = null } = {}) {
  const filters = readFilters(req);

  res.status(httpStatus).render("reports", {
    reports: await getReports(filters),
    statuses: REPORT_STATUSES,
    filters,
    error
  });
}

export async function showReports(req, res) {
  await renderBoard(req, res);
}

export async function createReport(req, res) {
  try {
    await addReport({
      unit: req.body?.unit,
      description: req.body?.description,
      ownerId: req.user.id
    });

    res.redirect("/reports");
  } catch (error) {
    if (!error.expose) throw error;

    await renderBoard(req, res, {
      status: error.status || 400,
      error: error.message
    });
  }
}

export async function changeReportStatus(req, res) {
  const updated = await updateReportStatus(
    req.params.id,
    req.body?.status,
    req.user
  );

  // htmx replaces just this card, so the response is the one card rather than
  // the whole board — a full re-render would discard the caller's scroll
  // position and any focus inside another card.
  res.render("partials/report-card", {
    report: updated,
    statuses: REPORT_STATUSES,
    user: req.user
  });
}

export async function removeReport(req, res) {
  await deleteReport(req.params.id, req.user);

  // Empty body on purpose: hx-swap="outerHTML" replaces the card with this,
  // which removes it from the page.
  res.send("");
}
