import bcrypt from "bcrypt";

import {
  findByEmail,
  create
} from "../repositories/usersRepository.js";

import { config } from "../config/env.js";
import { badRequest, unauthorized } from "../lib/httpError.js";

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 200; // bcrypt truncates past 72 bytes; reject long input
                          // outright rather than silently ignore the tail.

// Deliberately permissive: enough to catch a typo, not a standards-compliant
// address grammar. Anything stricter rejects real addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A real hash of a value nobody can log in with. When the email is unknown
// there is no stored hash to compare against, and returning early would make
// "no such account" measurably faster than "wrong password" — the same
// enumeration leak the shared error message below is there to prevent.
// Comparing against this instead keeps both paths doing bcrypt work.
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4Vs6R8g1BZ4uNKPKGDPLuU2Rq0kO4Vy";

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export async function signup({ email, password } = {}) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !password) {
    throw badRequest("Email and password are required.");
  }

  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw badRequest("Enter a valid email address.");
  }

  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    throw badRequest(
      `Password must be at least ${PASSWORD_MIN} characters.`
    );
  }

  if (password.length > PASSWORD_MAX) {
    throw badRequest(
      `Password must be ${PASSWORD_MAX} characters or fewer.`
    );
  }

  if (await findByEmail(cleanEmail)) {
    throw badRequest("Email already registered.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Admin is granted by matching a configured address, never by anything the
  // signup form can send. A `role` field in the request body is not read here
  // and could not become one if it were: the object handed to the repository
  // is built from validated locals only.
  const role =
    config.adminEmail && cleanEmail === config.adminEmail
      ? "admin"
      : "member";

  const user = await create({
    email: cleanEmail,
    passwordHash,
    role
  });

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };
}

export async function login({ email, password } = {}) {
  const cleanEmail = normalizeEmail(email);
  const user = await findByEmail(cleanEmail);

  // One message for "no such account" and for "wrong password", by design:
  // distinguishing them turns the login form into an oracle for which email
  // addresses are registered.
  const candidate = typeof password === "string" ? password : "";

  const passwordMatches = await bcrypt.compare(
    candidate,
    user?.passwordHash || DUMMY_HASH
  );

  if (!user || !passwordMatches) {
    throw unauthorized("Incorrect email or password.");
  }

  return user;
}
