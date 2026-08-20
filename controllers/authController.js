import {
  signup as signupUser,
  login as loginUser
} from "../services/authService.js";

import {
  createSession,
  destroySession,
  SESSION_TIMEOUTS
} from "../sessions.js";

import { config } from "../config/env.js";
import { issueCsrfToken } from "../middleware/csrf.js";

// Failures re-render the auth page with the message inline instead of sending
// a bare string. res.send(error.message) produced a plain-text page with no
// heading, no form and no way back, which strands a keyboard user completely.
function renderAuthError(res, status, form, req, message) {
  res.status(status).render("auth", {
    error: message,
    errorForm: form,
    email: typeof req.body?.email === "string" ? req.body.email : "",
    signedUp: false
  });
}

function sessionCookieOptions() {
  return {
    signed: true,
    // Unreadable from script, so an injected script cannot steal the session.
    httpOnly: true,
    // Not sent on cross-site POSTs, which removes the simplest CSRF shape
    // before the token check in middleware/csrf.js even runs.
    sameSite: "lax",
    // Never sent over plain http in production, so a downgraded or
    // intercepted request cannot carry the session id in the clear.
    secure: config.cookieSecure,
    maxAge: SESSION_TIMEOUTS.idleMs,
    path: "/"
  };
}

export async function signup(req, res) {
  try {
    await signupUser(req.body);
    res.redirect("/login?signedUp=1");
  } catch (error) {
    // 4xx from the service is user-correctable input and belongs on the form;
    // anything else is a real fault and goes to the error handler.
    if (!error.expose) throw error;

    renderAuthError(res, error.status || 400, "signup", req, error.message);
  }
}

export async function login(req, res) {
  try {
    const user = await loginUser(req.body);

    // Any session id the browser arrived holding is discarded, and the CSRF
    // token is reissued, so a token planted before login cannot be replayed
    // against the authenticated session that follows.
    const previousSessionId = req.signedCookies?.sessionId;

    if (previousSessionId) destroySession(previousSessionId);

    const sessionId = createSession(user);

    res.cookie("sessionId", sessionId, sessionCookieOptions());
    issueCsrfToken(res, { secure: config.cookieSecure });

    res.redirect("/reports");
  } catch (error) {
    if (!error.expose) throw error;

    renderAuthError(res, error.status || 401, "login", req, error.message);
  }
}

export function logout(req, res) {
  const sessionId = req.signedCookies?.sessionId;

  if (sessionId) {
    destroySession(sessionId);
  }

  res.clearCookie("sessionId", { path: "/" });
  issueCsrfToken(res, { secure: config.cookieSecure });

  res.redirect("/login");
}
