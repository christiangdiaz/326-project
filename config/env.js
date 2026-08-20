import { randomBytes } from "node:crypto";

// Single place where process.env is read and validated.
//
// Everything else in the app imports from here rather than touching
// process.env directly, so there is exactly one file to look at when asking
// "what does this app need to boot?" and exactly one place where a missing or
// unsafe value can be rejected before the server starts serving traffic.

const MIN_SECRET_LENGTH = 32;

// Values that used to ship as the in-repo fallback. Refusing them by name
// stops a copy-pasted development secret from silently becoming the
// production signing key.
const REJECTED_SECRETS = new Set([
  "dev-secret",
  "secret",
  "changeme",
  "change-me"
]);

function readNodeEnv() {
  const value = process.env.NODE_ENV?.trim().toLowerCase();

  return value === "production" || value === "test"
    ? value
    : "development";
}

function readPort() {
  const raw = process.env.PORT;

  if (raw === undefined || raw.trim() === "") return 3000;

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(
      `PORT must be an integer between 0 and 65535 (got "${raw}").`
    );
  }

  return port;
}

// The vulnerability this replaces: the session secret used to fall back to a
// hard-coded literal committed to the repository. Anyone holding that string
// can forge a signed sessionId cookie for any user, including an admin, so it
// is a full authentication bypass the moment the app runs anywhere real.
//
// Production now refuses to boot without a real secret. Development gets a
// random one per process, which is both safe and disposable: restarting the
// server invalidates existing cookies, which is the correct behaviour for a
// throwaway key and is impossible to mistake for a stable value worth reusing.
function readSessionSecret(nodeEnv, warn) {
  const secret = process.env.SESSION_SECRET?.trim();

  if (!secret) {
    if (nodeEnv === "production") {
      throw new Error(
        "SESSION_SECRET is required in production. Generate one with: " +
          "node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\""
      );
    }

    warn(
      "SESSION_SECRET is not set. Generating a random one for this process; " +
        "sessions will not survive a restart."
    );

    return randomBytes(48).toString("base64url");
  }

  if (REJECTED_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      `SESSION_SECRET is set to the well-known placeholder "${secret}". Use a random value.`
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    const message =
      `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters ` +
      `(got ${secret.length}).`;

    if (nodeEnv === "production") throw new Error(message);

    warn(message);
  }

  return secret;
}

function readTrustProxy() {
  const raw = process.env.TRUST_PROXY?.trim();

  if (!raw || raw === "0" || raw.toLowerCase() === "false") return false;

  const hops = Number(raw);

  return Number.isInteger(hops) && hops > 0 ? hops : raw;
}

// Quiet under Jest: the suite loads this module many times over and a
// warning about a generated development secret is noise there, not a finding.
const defaultWarn = (message) => {
  if (process.env.NODE_ENV !== "test") console.warn(`[config] ${message}`);
};

export function loadConfig({ warn = defaultWarn } = {}) {
  const nodeEnv = readNodeEnv();

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
    port: readPort(),
    sessionSecret: readSessionSecret(nodeEnv, warn),
    mongoUri:
      process.env.MONGODB_URI?.trim() ||
      // 127.0.0.1 rather than localhost: on Windows with Node 18+, "localhost"
      // can resolve to ::1 first and hang against a MongoDB bound to IPv4.
      "mongodb://127.0.0.1:27017/maintenance_reports",
    adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
    // Off unless asked for. With trust proxy enabled, Express believes the
    // X-Forwarded-For header — which anyone can send — so turning it on
    // without a proxy in front lets a client choose its own rate-limit
    // bucket. Set TRUST_PROXY to the number of proxies actually in the path.
    trustProxy: readTrustProxy(),
    // Cookies are only marked Secure in production: a Secure cookie is
    // dropped by the browser over plain http, which would lock everyone out
    // of the local development server.
    cookieSecure: nodeEnv === "production"
  });
}

export const config = loadConfig();
