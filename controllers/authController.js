import {
  signup as signupUser,
  login as loginUser
} from "../services/authService.js";

import {
  createSession,
  destroySession
} from "../sessions.js";

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

export async function signup(req, res) {
  try {
    await signupUser(req.body);
    res.redirect("/login?signedUp=1");
  } catch (error) {
    renderAuthError(res, 400, "signup", req, error.message);
  }
}

export async function login(req, res) {
  try {
    const user = await loginUser(req.body);
    const sessionId = createSession(user);

    res.cookie("sessionId", sessionId, {
      signed: true,
      httpOnly: true
    });

    res.redirect("/reports");
  } catch (error) {
    renderAuthError(res, 401, "login", req, error.message);
  }
}

export function logout(req, res) {
  const sessionId = req.signedCookies.sessionId;

  if (sessionId) {
    destroySession(sessionId);
  }

  res.clearCookie("sessionId");
  res.redirect("/login");
}
