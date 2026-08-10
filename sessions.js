import { randomUUID } from "node:crypto";

const sessions = new Map();

export function createSession(user) {
  const id = randomUUID();

  // Email is carried alongside id and role so the header can name who is
  // signed in. Without it a tester switching between the member and admin
  // accounts has no way to tell which one the browser is currently holding.
  sessions.set(id, {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  });

  return id;
}

export function getSession(id) {
  return sessions.get(id);
}

export function destroySession(id) {
  sessions.delete(id);
}