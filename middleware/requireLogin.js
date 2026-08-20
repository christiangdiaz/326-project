import { forbidden, unauthorized } from "../lib/httpError.js";

export function requireLogin(req, res, next) {
  if (!req.user) {
    return next(unauthorized("Login required."));
  }

  next();
}

// Route-level role gate. The service layer still performs its own ownership
// check on every write — this is the cheap early rejection, not the authority.
export function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user) return next(unauthorized("Login required."));

    if (!roles.includes(req.user.role)) {
      return next(forbidden("You do not have access to that."));
    }

    next();
  };
}
