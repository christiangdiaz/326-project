import { jest } from "@jest/globals";

// End-to-end through the real middleware chain: security headers, cookies,
// CSRF, sessions, routing and the error handler, over a real socket. The only
// thing replaced is the database — the repositories become in-memory stores —
// so everything between the HTTP request and the data access runs for real.
//
// This is the layer that had no tests at all before: every rule below lives in
// middleware or wiring, and none of it is reachable from a service-level test.

process.env.SESSION_SECRET = "test-secret-that-is-long-enough-to-pass-checks";
process.env.NODE_ENV = "test";
delete process.env.ADMIN_EMAIL;

const reports = new Map();
const users = new Map();

let nextId = 0;

const objectId = () =>
  String(++nextId).padStart(24, "a");

const reportRepo = {
  getAll: jest.fn(async () =>
    [...reports.values()].sort((a, b) => b.createdAt - a.createdAt)
  ),
  findById: jest.fn(async (id) => reports.get(id) ?? null),
  create: jest.fn(async (data) => {
    const _id = objectId();
    const report = { ...data, _id, createdAt: Date.now() };

    reports.set(_id, report);

    return report;
  }),
  updateById: jest.fn(async (id, updates) => {
    const existing = reports.get(id);

    if (!existing) return null;

    const updated = { ...existing, ...updates };

    reports.set(id, updated);

    return updated;
  }),
  removeById: jest.fn(async (id) => {
    const existing = reports.get(id);

    reports.delete(id);

    return existing ?? null;
  })
};

const usersRepo = {
  findByEmail: jest.fn(async (email) => users.get(email) ?? null),
  create: jest.fn(async (data) => {
    const user = { ...data, _id: objectId() };

    users.set(user.email, user);

    return user;
  })
};

jest.unstable_mockModule(
  "../repositories/reportRepository.js",
  () => reportRepo
);

jest.unstable_mockModule(
  "../repositories/usersRepository.js",
  () => usersRepo
);

const { createApp } = await import("../app.js");
const { loadConfig } = await import("../config/env.js");
const { clearSessions } = await import("../sessions.js");

const config = loadConfig({ warn: () => {} });

let server;
let origin;

beforeAll(async () => {
  server = createApp({ config }).listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  reports.clear();
  users.clear();
  clearSessions();
  jest.clearAllMocks();
});

/* ---------- a browser, more or less ------------------------------------- */

// Enough of a cookie jar to exercise the real cookie flags: it stores what the
// server set, replays it, and lets a test assert on the attributes.
function newClient() {
  const jar = new Map();
  const attributes = new Map();

  return {
    jar,
    attributesFor: (name) => attributes.get(name) ?? "",
    async fetch(pathname, options = {}) {
      const headers = new Headers(options.headers);

      if (jar.size) {
        headers.set(
          "cookie",
          [...jar].map(([key, value]) => `${key}=${value}`).join("; ")
        );
      }

      const response = await fetch(`${origin}${pathname}`, {
        ...options,
        headers,
        redirect: "manual"
      });

      for (const cookie of response.headers.getSetCookie()) {
        const [pair, ...rest] = cookie.split("; ");
        const index = pair.indexOf("=");
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);

        attributes.set(name, rest.join("; "));

        if (!value || /Expires=Thu, 01 Jan 1970/i.test(cookie)) {
          jar.delete(name);
        } else {
          jar.set(name, value);
        }
      }

      return response;
    }
  };
}

const csrfFrom = (html) =>
  html.match(/name="_csrf" value="([^"]+)"/)?.[1] ??
  html.match(/X-CSRF-Token": "([^"]+)"/)?.[1];

async function tokenFor(client, pathname = "/reports") {
  const response = await client.fetch(pathname);

  return csrfFrom(await response.text());
}

const form = (fields) => new URLSearchParams(fields).toString();

const postForm = (client, pathname, fields) =>
  client.fetch(pathname, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form(fields)
  });

async function register(client, email, password = "correct-horse-battery") {
  await postForm(client, "/signup", {
    email,
    password,
    _csrf: await tokenFor(client, "/login")
  });

  await postForm(client, "/login", {
    email,
    password,
    _csrf: await tokenFor(client, "/login")
  });

  return client;
}

/* ---------- tests -------------------------------------------------------- */

describe("security headers", () => {
  test("every response carries the policy set", async () => {
    const response = await newClient().fetch("/reports");

    expect(response.headers.get("content-security-policy")).toContain(
      "script-src 'self'"
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
  });

  test("the framework is not advertised", async () => {
    const response = await newClient().fetch("/reports");

    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  test("no page loads script from another origin", async () => {
    const html = await (await newClient().fetch("/reports")).text();

    expect(html).toContain('src="/vendor/htmx.min.js"');
    expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
  });
});

describe("session cookie", () => {
  test("is signed, httpOnly, SameSite=Lax and expires", async () => {
    const client = await register(newClient(), "resident@example.com");
    const attributes = client.attributesFor("sessionId");

    expect(attributes).toMatch(/HttpOnly/i);
    expect(attributes).toMatch(/SameSite=Lax/i);
    expect(attributes).toMatch(/Max-Age=/i);
    // Signed by cookie-parser: the value is prefixed and carries a signature,
    // so a hand-written cookie is rejected rather than trusted.
    expect(client.jar.get("sessionId")).toMatch(/^s%3A/);
  });

  test("a forged session id is not accepted", async () => {
    const client = newClient();

    await client.fetch("/reports");
    client.jar.set("sessionId", "s%3Amade-up-session.made-up-signature");

    const html = await (await client.fetch("/reports")).text();

    expect(html).not.toContain("Signed in as");
  });

  test("logging out destroys the session server-side", async () => {
    const client = await register(newClient(), "resident@example.com");
    const stolen = client.jar.get("sessionId");

    await postForm(client, "/logout", { _csrf: await tokenFor(client) });

    const thief = newClient();

    await thief.fetch("/reports");
    thief.jar.set("sessionId", stolen);

    expect(await (await thief.fetch("/reports")).text()).not.toContain(
      "Signed in as"
    );
  });
});

describe("CSRF protection", () => {
  test("a POST without a token is refused", async () => {
    const client = await register(newClient(), "resident@example.com");

    const response = await postForm(client, "/reports", {
      unit: "2C",
      description: "Leaky sink"
    });

    expect(response.status).toBe(403);
    expect(reportRepo.create).not.toHaveBeenCalled();
  });

  test("a POST with someone else's token is refused", async () => {
    const client = await register(newClient(), "resident@example.com");
    const other = await tokenFor(newClient(), "/login");

    const response = await postForm(client, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: other
    });

    expect(response.status).toBe(403);
    expect(reportRepo.create).not.toHaveBeenCalled();
  });

  test("a DELETE without the header is refused", async () => {
    const client = await register(newClient(), "resident@example.com");

    await postForm(client, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: await tokenFor(client)
    });

    const [report] = [...reports.values()];

    const response = await client.fetch(`/reports/${report._id}`, {
      method: "DELETE"
    });

    expect(response.status).toBe(403);
    expect(reports.has(report._id)).toBe(true);
  });

  test("the token cookie is not readable by script", async () => {
    const client = newClient();

    await client.fetch("/reports");

    expect(client.attributesFor("csrfToken")).toMatch(/HttpOnly/i);
  });

  test("GET is never blocked", async () => {
    expect((await newClient().fetch("/reports")).status).toBe(200);
  });
});

describe("authentication and authorization", () => {
  test("posting a report without a session is a 401", async () => {
    const client = newClient();

    const response = await postForm(client, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: await tokenFor(client)
    });

    expect(response.status).toBe(401);
  });

  test("signup rejects a short password", async () => {
    const client = newClient();

    const response = await postForm(client, "/signup", {
      email: "resident@example.com",
      password: "short",
      _csrf: await tokenFor(client, "/login")
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("at least 10 characters");
    expect(usersRepo.create).not.toHaveBeenCalled();
  });

  test("a signup cannot make itself an admin", async () => {
    const client = newClient();

    await postForm(client, "/signup", {
      email: "resident@example.com",
      password: "correct-horse-battery",
      role: "admin",
      _csrf: await tokenFor(client, "/login")
    });

    expect(users.get("resident@example.com").role).toBe("member");
  });

  test("a wrong password and an unknown account give the same answer", async () => {
    const client = await register(newClient(), "resident@example.com");

    await postForm(client, "/logout", { _csrf: await tokenFor(client) });

    const wrong = await postForm(client, "/login", {
      email: "resident@example.com",
      password: "not-the-password",
      _csrf: await tokenFor(client, "/login")
    });

    const unknown = await postForm(client, "/login", {
      email: "nobody@example.com",
      password: "not-the-password",
      _csrf: await tokenFor(client, "/login")
    });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.text()).toContain("Incorrect email or password.");
    expect(await unknown.text()).toContain("Incorrect email or password.");
  });

  test("one member cannot delete another member's report", async () => {
    const owner = await register(newClient(), "owner@example.com");

    await postForm(owner, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: await tokenFor(owner)
    });

    const [report] = [...reports.values()];
    const intruder = await register(newClient(), "intruder@example.com");

    const response = await intruder.fetch(`/reports/${report._id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": await tokenFor(intruder) }
    });

    expect(response.status).toBe(403);
    expect(reports.has(report._id)).toBe(true);
  });

  test("the owner can delete their own report", async () => {
    const owner = await register(newClient(), "owner@example.com");

    await postForm(owner, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: await tokenFor(owner)
    });

    const [report] = [...reports.values()];

    const response = await owner.fetch(`/reports/${report._id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": await tokenFor(owner) }
    });

    expect(response.status).toBe(200);
    expect(reports.has(report._id)).toBe(false);
  });
});

describe("rate limiting", () => {
  test("repeated failed logins are throttled", async () => {
    const client = newClient();
    const attempt = async () =>
      postForm(client, "/login", {
        email: "target@example.com",
        password: "guess",
        _csrf: await tokenFor(client, "/login")
      });

    let last;

    for (let i = 0; i < 11; i += 1) last = await attempt();

    expect(last.status).toBe(429);
    expect(last.headers.get("retry-after")).toBeTruthy();
  });

  test("a successful login clears the counter", async () => {
    const password = "correct-horse-battery";
    const client = await register(newClient(), "resident@example.com");

    await postForm(client, "/logout", { _csrf: await tokenFor(client) });

    const guess = async () =>
      postForm(client, "/login", {
        email: "resident@example.com",
        password: "wrong",
        _csrf: await tokenFor(client, "/login")
      });

    for (let i = 0; i < 9; i += 1) expect((await guess()).status).toBe(401);

    const success = await postForm(client, "/login", {
      email: "resident@example.com",
      password,
      _csrf: await tokenFor(client, "/login")
    });

    expect(success.status).toBe(302);

    // Nine more failures would have crossed the limit had the successful
    // login not reset the budget.
    for (let i = 0; i < 9; i += 1) expect((await guess()).status).toBe(401);
    // Nineteen real bcrypt comparisons at production cost; the default 5s
    // budget is not enough and lowering the work factor for tests would mean
    // testing a cheaper password hash than the one that ships.
  }, 30000);
});

describe("status changes", () => {
  test("the owner can move a report through the workflow", async () => {
    const owner = await register(newClient(), "owner@example.com");

    await postForm(owner, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: await tokenFor(owner)
    });

    const [report] = [...reports.values()];

    const response = await owner.fetch(`/reports/${report._id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": await tokenFor(owner)
      },
      body: form({ status: "Resolved" })
    });

    expect(response.status).toBe(200);
    // The response is the single card htmx swaps back in, not the whole page.
    const html = await response.text();

    expect(html).toContain("Resolved");
    expect(html).not.toContain("<html");
    expect(reports.get(report._id).status).toBe("Resolved");
  });

  test("an invalid status is rejected", async () => {
    const owner = await register(newClient(), "owner@example.com");

    await postForm(owner, "/reports", {
      unit: "2C",
      description: "Leaky sink",
      _csrf: await tokenFor(owner)
    });

    const [report] = [...reports.values()];

    const response = await owner.fetch(`/reports/${report._id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": await tokenFor(owner)
      },
      body: form({ status: "Cancelled" })
    });

    expect(response.status).toBe(400);
    expect(reports.get(report._id).status).toBe("Open");
  });
});

describe("JSON API", () => {
  test("lists reports and honours the status filter", async () => {
    const owner = await register(newClient(), "owner@example.com");

    for (const unit of ["2C", "4A"]) {
      await postForm(owner, "/reports", {
        unit,
        description: `Problem in ${unit}`,
        _csrf: await tokenFor(owner)
      });
    }

    const body = await (await newClient().fetch("/api/reports")).json();

    expect(body.count).toBe(2);
    expect(body.reports[0]).toHaveProperty("status", "Open");
    // The internal _id never leaves the API shape.
    expect(body.reports[0]).not.toHaveProperty("_id");

    const filtered = await (
      await newClient().fetch("/api/reports?status=Resolved")
    ).json();

    expect(filtered.count).toBe(0);
  });

  test("creating over the API requires a session and a token", async () => {
    const anonymous = newClient();
    const token = (await (await anonymous.fetch("/api/csrf")).json())
      .csrfToken;

    const unauthenticated = await anonymous.fetch("/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": token
      },
      body: JSON.stringify({ unit: "2C", description: "Leaky sink" })
    });

    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toHaveProperty("error");

    const member = await register(newClient(), "member@example.com");

    const created = await member.fetch("/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": await tokenFor(member)
      },
      body: JSON.stringify({ unit: "2c", description: "  Leaky sink  " })
    });

    expect(created.status).toBe(201);

    const { report } = await created.json();

    expect(report).toMatchObject({ unit: "2C", description: "Leaky sink" });
  });

  test("validation errors come back as JSON, not an HTML page", async () => {
    const member = await register(newClient(), "member@example.com");

    const response = await member.fetch("/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": await tokenFor(member)
      },
      body: JSON.stringify({ unit: "", description: "" })
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).error).toMatch(/required/);
  });

  test("publishes the status vocabulary", async () => {
    const body = await (await newClient().fetch("/api/statuses")).json();

    expect(body.statuses).toEqual(["Open", "In Progress", "Resolved"]);
  });
});

describe("errors", () => {
  test("an unknown page renders the error view", async () => {
    const response = await newClient().fetch("/nope");

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Page not found");
  });

  test("an unknown API path answers in JSON", async () => {
    const response = await newClient().fetch("/api/nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toHaveProperty("error");
  });

  test("an htmx request gets plain text it can show inline", async () => {
    const client = await register(newClient(), "member@example.com");

    const response = await client.fetch("/reports/missing", {
      method: "DELETE",
      headers: {
        "hx-request": "true",
        "x-csrf-token": await tokenFor(client)
      }
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });
});

describe("health", () => {
  test("reports degraded when the database is not connected", async () => {
    const response = await newClient().fetch("/health");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      database: "disconnected"
    });
  });

  test("needs no session and no CSRF token", async () => {
    const response = await newClient().fetch("/health");

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
