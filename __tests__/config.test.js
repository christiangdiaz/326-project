import { loadConfig } from "../config/env.js";

// These cover the vulnerability this branch exists to close: the session
// secret used to fall back to the literal "dev-secret", committed to the
// repository. cookie-parser signs the sessionId cookie with it, so anyone
// reading the source could mint a cookie for any user — including an admin —
// and the app would accept it. The rules below are what stop that fallback
// from ever coming back.

const KEYS = [
  "NODE_ENV",
  "SESSION_SECRET",
  "PORT",
  "MONGODB_URI",
  "ADMIN_EMAIL",
  "TRUST_PROXY"
];

const strongSecret = "s".repeat(48);
const silent = () => {};

let saved;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("session secret", () => {
  test("production refuses to start without one", () => {
    process.env.NODE_ENV = "production";

    expect(() => loadConfig({ warn: silent })).toThrow(
      /SESSION_SECRET is required in production/
    );
  });

  test("production refuses the old committed placeholder", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "dev-secret";

    expect(() => loadConfig({ warn: silent })).toThrow(/placeholder/);
  });

  test("the placeholder is refused in development too", () => {
    process.env.SESSION_SECRET = "dev-secret";

    expect(() => loadConfig({ warn: silent })).toThrow(/placeholder/);
  });

  test("production refuses a secret that is too short to matter", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "short";

    expect(() => loadConfig({ warn: silent })).toThrow(/at least 32/);
  });

  test("development generates a random secret and says so", () => {
    const warnings = [];
    const first = loadConfig({ warn: (m) => warnings.push(m) });
    const second = loadConfig({ warn: silent });

    expect(warnings.join(" ")).toMatch(/SESSION_SECRET is not set/);
    expect(first.sessionSecret).toHaveLength(64);
    // Different every process: a generated secret must not be reproducible,
    // or it is a hard-coded one with extra steps.
    expect(first.sessionSecret).not.toBe(second.sessionSecret);
  });

  test("a strong secret is used as given", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = strongSecret;

    expect(loadConfig({ warn: silent }).sessionSecret).toBe(strongSecret);
  });
});

describe("cookie flags", () => {
  test("Secure is on in production", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = strongSecret;

    expect(loadConfig({ warn: silent }).cookieSecure).toBe(true);
  });

  test("Secure is off in development, where there is no TLS to require", () => {
    expect(loadConfig({ warn: silent }).cookieSecure).toBe(false);
  });
});

describe("other values", () => {
  test("rejects a port that is not a port", () => {
    process.env.PORT = "not-a-port";

    expect(() => loadConfig({ warn: silent })).toThrow(/PORT must be/);
  });

  test("defaults the port to 3000", () => {
    expect(loadConfig({ warn: silent }).port).toBe(3000);
  });

  test("normalizes the admin email", () => {
    process.env.ADMIN_EMAIL = "  Manager@Example.COM ";

    expect(loadConfig({ warn: silent }).adminEmail).toBe(
      "manager@example.com"
    );
  });

  test("trust proxy is off unless explicitly configured", () => {
    expect(loadConfig({ warn: silent }).trustProxy).toBe(false);

    process.env.TRUST_PROXY = "1";
    expect(loadConfig({ warn: silent }).trustProxy).toBe(1);
  });

  test("an unrecognized NODE_ENV is treated as development", () => {
    process.env.NODE_ENV = "staging";

    expect(loadConfig({ warn: silent }).nodeEnv).toBe("development");
  });
});
