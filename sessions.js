import { randomUUID } from "node:crypto";

// Server-side session store.
//
// Two properties this needs that the previous Map did not have:
//
//   * Expiry. Entries lived until the process restarted, so a session id
//     captured once stayed valid indefinitely — and the Map grew by one entry
//     per login, forever, which is a slow memory leak in the same breath.
//   * A way to invalidate every session belonging to a user, which is what
//     "log out everywhere" and any future password change need.
//
// Still in-process by design: a second instance of the app would not see these
// sessions. That is the documented limitation of the store, not an accident,
// and the interface below is what a Redis-backed replacement would implement.

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours without a request
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // hard cap, even if active
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

const sessions = new Map();

function isExpired(session, now) {
  return (
    now - session.lastSeenAt > IDLE_TIMEOUT_MS ||
    now - session.createdAt > ABSOLUTE_TIMEOUT_MS
  );
}

export function createSession(user, now = Date.now()) {
  const id = randomUUID();

  // Email is carried alongside id and role so the header can name who is
  // signed in. Without it a tester switching between the member and admin
  // accounts has no way to tell which one the browser is currently holding.
  sessions.set(id, {
    id: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role,
    createdAt: now,
    lastSeenAt: now
  });

  return id;
}

// Reading a session is also a liveness signal, so the idle clock restarts on
// every request. `touch: false` lets a caller inspect a session without
// extending it.
export function getSession(id, { touch = true, now = Date.now() } = {}) {
  const session = sessions.get(id);

  if (!session) return undefined;

  if (isExpired(session, now)) {
    sessions.delete(id);
    return undefined;
  }

  if (touch) session.lastSeenAt = now;

  return session;
}

export function destroySession(id) {
  sessions.delete(id);
}

export function destroySessionsForUser(userId) {
  let removed = 0;

  for (const [id, session] of sessions) {
    if (session.id === userId) {
      sessions.delete(id);
      removed += 1;
    }
  }

  return removed;
}

export function sweepExpiredSessions(now = Date.now()) {
  let removed = 0;

  for (const [id, session] of sessions) {
    if (isExpired(session, now)) {
      sessions.delete(id);
      removed += 1;
    }
  }

  return removed;
}

export function sessionCount() {
  return sessions.size;
}

// Test-only reset. Sessions are module state, and a suite that logs in twice
// should not have to care about what the previous test left behind.
export function clearSessions() {
  sessions.clear();
}

// unref() so an idle sweeper never holds the process open — without it,
// `node server.js` would refuse to exit and Jest would report an open handle.
export function startSessionSweeper(interval = SWEEP_INTERVAL_MS) {
  const timer = setInterval(() => sweepExpiredSessions(), interval);

  timer.unref();

  return () => clearInterval(timer);
}

export const SESSION_TIMEOUTS = Object.freeze({
  idleMs: IDLE_TIMEOUT_MS,
  absoluteMs: ABSOLUTE_TIMEOUT_MS
});
