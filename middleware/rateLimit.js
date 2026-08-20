import { tooManyRequests } from "../lib/httpError.js";

// Fixed-window rate limiter, in memory.
//
// Aimed at the login form specifically. bcrypt makes a single guess expensive
// for the attacker, but it makes it expensive for *this process* too: an
// unthrottled /login is both a credential-stuffing surface and a way to pin
// the event loop with hash comparisons. Counting attempts per client and per
// email means one noisy source cannot lock out an unrelated account.
//
// In memory, like the session store: correct for one instance, and the piece
// to swap first if this ever runs behind more than one.

function clientKey(req) {
  // req.ip already honours trust proxy when it is configured; the fallback
  // covers a socket that has been torn down mid-request.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = "Too many attempts. Please wait a few minutes and try again.",
  keyFor = clientKey,
  // A successful request clears the counter, so someone who mistypes twice
  // and then logs in correctly does not carry a penalty into their next
  // session. Only failures accumulate, which is what the limit is for.
  resetOnSuccess = true,
  now = Date.now
} = {}) {
  const hits = new Map();

  function prune(current) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= current) hits.delete(key);
    }
  }

  function middleware(req, res, next) {
    const current = now();
    const key = keyFor(req);

    // Cheap enough to do inline: the map only ever holds keys seen within one
    // window, so there is nothing to schedule a sweep for.
    prune(current);

    const entry = hits.get(key) ?? {
      count: 0,
      resetAt: current + windowMs
    };

    entry.count += 1;
    hits.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - current) / 1000);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(resetSeconds));

      return next(
        tooManyRequests(message, { code: "RATE_LIMITED" })
      );
    }

    if (resetOnSuccess) {
      res.on("finish", () => {
        // A redirect after a successful login is a 302, so anything below 400
        // counts as success here.
        if (res.statusCode < 400) hits.delete(key);
      });
    }

    next();
  }

  // Exposed for tests, which need to start from a known state.
  middleware.reset = (key) => hits.delete(key);
  middleware.resetAll = () => hits.clear();
  middleware.keyFor = keyFor;

  return middleware;
}

// Keyed on client *and* submitted email: an attacker spraying one password
// across many accounts is throttled by the shared client half, while a
// targeted attack from rotating addresses is throttled by the email half.
export function loginKey(req) {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  return `${clientKey(req)}|${email}`;
}
