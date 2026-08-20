import { getSession } from "../sessions.js";

// Resolves the signed sessionId cookie into req.user for everything downstream.
//
// The cookie carries an opaque id and nothing else: role and identity are read
// from the server-side store on every request, so a user demoted from admin
// loses the privilege immediately rather than at the end of their session.
export function attachUser(req, res, next) {
  const sessionId = req.signedCookies?.sessionId;

  if (!sessionId) return next();

  const session = getSession(sessionId);

  if (!session) {
    // Expired, revoked, or signed with a previous secret. Clearing it stops
    // the browser from re-presenting a dead id on every subsequent request.
    res.clearCookie("sessionId", { path: "/" });

    return next();
  }

  req.user = {
    id: session.id,
    email: session.email,
    role: session.role
  };

  // Views read `user` from locals; res.locals.user means no route has to
  // remember to pass it into every render call.
  res.locals.user = req.user;

  next();
}
