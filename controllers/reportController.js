import {
  getReports,
  addReport,
  deleteReport
} from "../services/reportService.js";

export async function showReports(req, res) {
  res.render("reports", {
    reports: await getReports(),
    error: null
  });
}

export async function createReport(req, res) {
  try {
    await addReport(req.body);

    res.redirect("/reports");
  } catch (error) {
    res.status(400).render("reports", {
      reports: await getReports(),
      error: error.message
    });
  }
}

export async function removeReport(req, res) {
  try {
    await deleteReport(req.params.id);
    res.send("");
  } catch (error) {
    res.status(404).send(error.message);
  }
}