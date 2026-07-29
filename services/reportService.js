import {
  readReports,
  saveReports
} from "../repositories/reportRepository.js";

export function getReports() {
  return readReports();
}

export function addReport({ unit, description }) {
  if (!unit?.trim() || !description?.trim()) {
    throw new Error(
      "Unit number and description are required."
    );
  }

  const reports = readReports();

  const newReport = {
    id: Date.now(),
    unit: unit.trim(),
    description: description.trim(),
    status: "Open"
  };

  reports.push(newReport);
  saveReports(reports);

  return newReport;
}