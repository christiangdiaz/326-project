import bcrypt from "bcrypt";
import {
  findByEmail,
  create
} from "../repositories/usersRepository.js";

export async function signup({ email, password } = {}) {
  const cleanEmail =
    typeof email === "string"
      ? email.trim().toLowerCase()
      : "";

  if (!cleanEmail || !password) {
    throw new Error("Email and password are required.");
  }

  if (await findByEmail(cleanEmail)) {
    throw new Error("Email already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const adminEmail =
    process.env.ADMIN_EMAIL?.toLowerCase();

  const role =
    adminEmail && cleanEmail === adminEmail
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
  const cleanEmail =
    typeof email === "string"
      ? email.trim().toLowerCase()
      : "";

  const user = await findByEmail(cleanEmail);

  if (
    !user ||
    !(await bcrypt.compare(password || "", user.passwordHash))
  ) {
    throw new Error("Incorrect email or password.");
  }

  return user;
}