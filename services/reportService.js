import {
  getAll,
  create,
  updateById,
  removeById
} from "../repositories/reportRepository.js";

// Defined here rather than imported from the repository: the Jest suite
// replaces that whole module with mocks, so a shared constant would be
// undefined inside every test.
export const ALLOWED_STATUSES = ["Open", "In Progress", "Resolved"];

const UNIT_MAX = 10;
const DESCRIPTION_MAX = 500;

export async function getReports() {
  return getAll();
}

export async function addReport({ unit, description } = {}) {
  const cleanUnit = typeof unit === "string" ? unit.trim() : "";
  const cleanDescription =
    typeof description === "string" ? description.trim() : "";

  if (!cleanUnit || !cleanDescription) {
    throw new Error("Unit number and description are required.");
  }

  if (cleanUnit.length > UNIT_MAX) {
    throw new Error(
      `Unit number must be ${UNIT_MAX} characters or fewer.`
    );
  }

  if (cleanDescription.length > DESCRIPTION_MAX) {
    throw new Error(
      `Description must be ${DESCRIPTION_MAX} characters or fewer.`
    );
  }

  return create({
    unit: cleanUnit.toUpperCase(),
    description: cleanDescription,
    status: "Open" // residents never choose a status
  });
}

export async function updateReportStatus(id, status) {
  if (!id) {
    throw new Error("Report id is required.");
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(
      `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  const updated = await updateById(id, { status });

  if (!updated) {
    throw new Error("Report not found.");
  }

  return updated;
}

export async function deleteReport(id) {
  if (!id) {
    throw new Error("Report id is required.");
  }

  const removed = await removeById(id);

  if (!removed) {
    throw new Error("Report not found.");
  }

  return removed;
}
