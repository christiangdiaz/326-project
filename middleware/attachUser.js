import { getSession } from "../sessions.js";

export function attachUser(req, res, next) {
  const sessionId =
    req.signedCookies.sessionId;

  if (sessionId) {
    req.user = getSession(sessionId);
  }

  next();
}