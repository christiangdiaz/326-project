import {
  getReports,
  addReport
} from "../services/reportService.js";

export function showReports(req, res) {
  res.render("reports", {
    reports: getReports(),
    error: null
  });
}

export function createReport(req, res) {
  try {
    addReport(req.body);

    res.redirect("/reports");
  } catch (error) {
    res.status(400).render("reports", {
      reports: getReports(),
      error: error.message
    });
  }
}
