import {
  signup as signupUser,
  login as loginUser
} from "../services/authService.js";

import {
  createSession,
  destroySession
} from "../sessions.js";

export async function signup(req, res) {
  try {
    await signupUser(req.body);
    res.redirect("/login");
  } catch (error) {
    res.status(400).send(error.message);
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
    res.status(401).send(error.message);
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