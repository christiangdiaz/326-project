// The status vocabulary, owned by one module.
//
// This list used to exist twice — once in services/reportService.js and once
// in the Mongoose schema — with a comment on each copy asking the reader to
// keep them in sync by hand. The reason given was that the Jest suite replaces
// the repository module wholesale, so a constant exported from there would be
// undefined inside every test.
//
// That reason is real, but it only rules out the *repository* as the home for
// the constant. A module that nothing mocks can be imported by both sides
// safely, which is what this is: no Mongoose import, no side effects, nothing
// a test would ever want to stub.

export const REPORT_STATUSES = Object.freeze([
  "Open",
  "In Progress",
  "Resolved"
]);

export const DEFAULT_REPORT_STATUS = "Open";

export function isReportStatus(value) {
  return REPORT_STATUSES.includes(value);
}
