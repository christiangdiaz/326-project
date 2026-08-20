import {
  getAll,
  create,
  updateById,
  removeById,
  findById
} from "../repositories/reportRepository.js";

import {
  DEFAULT_REPORT_STATUS,
  REPORT_STATUSES,
  isReportStatus
} from "../constants/reportStatus.js";

import { reportEvents } from "../lib/reportEvents.js";
import { badRequest, forbidden, notFound } from "../lib/httpError.js";

// Re-exported for the callers that used to import it from here. The list
// itself now lives in constants/reportStatus.js, which both this module and
// the Mongoose schema read, so the two copies that had to be hand-synced are
// gone.
export const ALLOWED_STATUSES = REPORT_STATUSES;

const UNIT_MAX = 10;
const DESCRIPTION_MAX = 500;

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Filtering happens here rather than in the query so the rules are unit
// testable without a database, and so the repository keeps a single read path.
export async function getReports({ status, search } = {}) {
  const reports = await getAll();

  const wanted = isReportStatus(status) ? status : null;
  const needle = text(search).toLowerCase();

  if (!wanted && !needle) return reports;

  return reports.filter((report) => {
    if (wanted && report.status !== wanted) return false;

    if (!needle) return true;

    return (
      report.unit?.toLowerCase().includes(needle) ||
      report.description?.toLowerCase().includes(needle)
    );
  });
}

export async function addReport({ unit, description, ownerId } = {}) {
  const cleanUnit = text(unit);
  const cleanDescription = text(description);

  if (!cleanUnit || !cleanDescription) {
    throw badRequest("Unit number and description are required.");
  }

  if (cleanUnit.length > UNIT_MAX) {
    throw badRequest(
      `Unit number must be ${UNIT_MAX} characters or fewer.`
    );
  }

  if (cleanDescription.length > DESCRIPTION_MAX) {
    throw badRequest(
      `Description must be ${DESCRIPTION_MAX} characters or fewer.`
    );
  }

  // Built field by field from validated input rather than spread from the
  // request body: a client that posts `status` or `ownerId` of its own cannot
  // reach the database through this path.
  const report = {
    unit: cleanUnit.toUpperCase(),
    description: cleanDescription,
    status: DEFAULT_REPORT_STATUS
  };

  if (ownerId) {
    report.ownerId = ownerId;
  }

  const created = await create(report);

  reportEvents.emitChange("created", created);

  return created;
}

// Deleting and re-statusing a report answer the same question — may this user
// change this report? — so they ask it in one place.
function assertCanModify(report, user) {
  if (user?.role === "admin") return;

  if (!user || report.ownerId !== user.id) {
    throw forbidden("You can only change your own reports.");
  }
}

export async function updateReportStatus(id, status, user) {
  if (!id) {
    throw badRequest("Report id is required.");
  }

  if (!isReportStatus(status)) {
    throw badRequest(
      `Status must be one of: ${REPORT_STATUSES.join(", ")}.`
    );
  }

  // Read before write so the ownership check runs against the stored report
  // rather than against whatever the caller claims it contains.
  if (user) {
    const existing = await findById(id);

    if (!existing) throw notFound("Report not found.");

    assertCanModify(existing, user);
  }

  const updated = await updateById(id, { status });

  if (!updated) {
    throw notFound("Report not found.");
  }

  reportEvents.emitChange("updated", updated);

  return updated;
}

export async function deleteReport(id, user) {
  if (!id) {
    throw badRequest("Report id is required.");
  }

  const report = await findById(id);

  if (!report) {
    throw notFound("Report not found.");
  }

  assertCanModify(report, user);

  const removed = await removeById(id);

  reportEvents.emitChange("deleted", report);

  return removed;
}
