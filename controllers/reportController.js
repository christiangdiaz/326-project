import {
  getReports,
  addReport
} from "../services/reportService.js";

export function showReports(req, res) {
  res.json(getReports());
}

export function createReport(req, res) {
  try {
    const report = addReport(req.body);

    res.status(201).send(
      `Report submitted for unit ${report.unit}`
    );
  } catch (error) {
    res.status(400).send(error.message);
  }
}