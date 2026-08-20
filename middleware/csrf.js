import { randomBytes, timingSafeEqual } from "node:crypto";

import { forbidden } from "../lib/httpError.js";

// Cross-site request forgery protection, double-submit style.
//
// Why it is needed here: authentication is a cookie, and the browser attaches
// cookies to a cross-site form post just as willingly as to a first-party one.
// Without this, any page on the internet could host a hidden form that posts
// to /reports — or DELETEs one — and it would run with the logged-in visitor's
// session. SameSite=Lax on the session cookie blocks the common shapes of that
// attack, but it is one flag on one cookie in one browser generation, and it
// deliberately still permits top-level GET navigation. This is the check that
// does not depend on the browser getting it right.
//
// The token lives in a signed, httpOnly cookie, so script on the page cannot
// read it and a forger cannot set it. The copy the request has to echo back is
// rendered into the page by the server: a hidden field for the plain forms, a
// header for htmx, both carrying a value only a same-origin document could
// have been given.

const COOKIE_NAME = "csrfToken";
const HEADER_NAME = "x-csrf-token";
const FIELD_NAME = "_csrf";
const TOKEN_BYTES = 32;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function newToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function cookieOptions(secure) {
  return {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/"
  };
}

// Constant-time comparison. A plain === leaks, through timing, how much of a
// guess was correct, which is enough to reconstruct a token one byte at a time.
function matches(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

function submittedToken(req) {
  const header = req.get(HEADER_NAME);

  if (typeof header === "string" && header) return header;

  const field = req.body?.[FIELD_NAME];

  return typeof field === "string" ? field : "";
}

export function issueCsrfToken(res, { secure = false } = {}) {
  const token = newToken();

  res.cookie(COOKIE_NAME, token, cookieOptions(secure));
  res.locals.csrfToken = token;

  return token;
}

export function csrfProtection({ secure = false } = {}) {
  return function checkCsrf(req, res, next) {
    const existing = req.signedCookies?.[COOKIE_NAME];

    // A missing or tampered cookie is replaced rather than rejected: on a safe
    // request that is simply a first visit, and on an unsafe one the freshly
    // minted token cannot match what was submitted, so the request still fails.
    res.locals.csrfToken =
      typeof existing === "string" && existing
        ? existing
        : issueCsrfToken(res, { secure });

    if (SAFE_METHODS.has(req.method)) return next();

    if (!matches(submittedToken(req), existing)) {
      return next(
        forbidden(
          "Your session could not be verified. Reload the page and try again.",
          { code: "CSRF_TOKEN_INVALID" }
        )
      );
    }

    next();
  };
}

export const CSRF_COOKIE_NAME = COOKIE_NAME;
export const CSRF_FIELD_NAME = FIELD_NAME;
export const CSRF_HEADER_NAME = HEADER_NAME;
