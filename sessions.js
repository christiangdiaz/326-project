import { randomUUID } from "node:crypto";

const sessions = new Map();

export function createSession(user) {
  const id = randomUUID();

  sessions.set(id, {
    id: user._id.toString(),
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