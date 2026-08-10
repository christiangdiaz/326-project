import {
  getAll,
  create,
  updateById,
  removeById,
  findById
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

export async function addReport({ unit, description, ownerId } = {}) {
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

    const report = {
    unit: cleanUnit.toUpperCase(),
    description: cleanDescription,
    status: "Open"
    };

    if (ownerId) {
    report.ownerId = ownerId;
    }

    return create(report);
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

export async function deleteReport(
  id,
  user
) {
  if (!id) {
    throw new Error(
      "Report id is required."
    );
  }

  const report = await findById(id);

  if (!report) {
    throw new Error(
      "Report not found."
    );
  }

  if (
    user.role !== "admin" &&
    report.ownerId !== user.id
  ) {
    const error =
      new Error("Forbidden.");

    error.status = 403;

    throw error;
  }

  return removeById(id);
}
