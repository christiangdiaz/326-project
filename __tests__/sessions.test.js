import { jest } from "@jest/globals";

import {
  SESSION_TIMEOUTS,
  clearSessions,
  createSession,
  destroySession,
  destroySessionsForUser,
  getSession,
  sessionCount,
  sweepExpiredSessions
} from "../sessions.js";

const user = {
  _id: { toString: () => "user-1" },
  email: "resident@example.com",
  role: "member"
};

beforeEach(() => {
  clearSessions();
});

describe("createSession", () => {
  test("stores the fields the header renders", () => {
    const id = createSession(user);

    expect(getSession(id)).toMatchObject({
      id: "user-1",
      email: "resident@example.com",
      role: "member"
    });
  });

  test("issues an unguessable id that differs every time", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => createSession(user))
    );

    expect(ids.size).toBe(50);
    // A v4 UUID, not a counter: a predictable id is a session anyone can take.
    expect([...ids][0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe("expiry", () => {
  test("a session past the idle timeout is not returned", () => {
    const start = 1_000_000;
    const id = createSession(user, start);

    // touch: false, or reading the session here would reset the very clock
    // the next assertion is testing.
    expect(
      getSession(id, {
        now: start + SESSION_TIMEOUTS.idleMs - 1,
        touch: false
      })
    ).toBeDefined();

    expect(getSession(id, { now: start + SESSION_TIMEOUTS.idleMs + 1 }))
      .toBeUndefined();
  });

  test("an expired session is dropped rather than left in the map", () => {
    const start = 1_000_000;
    const id = createSession(user, start);

    getSession(id, { now: start + SESSION_TIMEOUTS.idleMs + 1 });

    expect(sessionCount()).toBe(0);
  });

  test("activity pushes the idle deadline out", () => {
    const start = 1_000_000;
    const id = createSession(user, start);
    const halfway = start + SESSION_TIMEOUTS.idleMs / 2;

    getSession(id, { now: halfway });

    expect(
      getSession(id, { now: halfway + SESSION_TIMEOUTS.idleMs - 1 })
    ).toBeDefined();
  });

  test("touch: false inspects without extending the session", () => {
    const start = 1_000_000;
    const id = createSession(user, start);
    const halfway = start + SESSION_TIMEOUTS.idleMs / 2;

    getSession(id, { now: halfway, touch: false });

    expect(
      getSession(id, { now: start + SESSION_TIMEOUTS.idleMs + 1 })
    ).toBeUndefined();
  });

  test("the absolute timeout ends even a continuously active session", () => {
    const start = 1_000_000;
    const id = createSession(user, start);

    // Kept warm right up to the hard cap, then one step past it.
    for (
      let now = start;
      now < start + SESSION_TIMEOUTS.absoluteMs;
      now += SESSION_TIMEOUTS.idleMs / 2
    ) {
      expect(getSession(id, { now })).toBeDefined();
    }

    expect(
      getSession(id, { now: start + SESSION_TIMEOUTS.absoluteMs + 1 })
    ).toBeUndefined();
  });

  test("the sweeper removes expired sessions and leaves live ones", () => {
    const start = 1_000_000;
    const stale = createSession(user, start);
    const fresh = createSession(user, start + SESSION_TIMEOUTS.idleMs);

    const now = start + SESSION_TIMEOUTS.idleMs + 1;
    const removed = sweepExpiredSessions(now);

    expect(removed).toBe(1);
    expect(getSession(stale, { now })).toBeUndefined();
    expect(getSession(fresh, { now })).toBeDefined();
  });
});

describe("invalidation", () => {
  test("destroySession removes exactly one session", () => {
    const first = createSession(user);
    const second = createSession(user);

    destroySession(first);

    expect(getSession(first)).toBeUndefined();
    expect(getSession(second)).toBeDefined();
  });

  test("destroySessionsForUser logs a user out everywhere at once", () => {
    const laptop = createSession(user);
    const phone = createSession(user);
    const otherUser = createSession({
      _id: { toString: () => "user-2" },
      email: "other@example.com",
      role: "member"
    });

    expect(destroySessionsForUser("user-1")).toBe(2);
    expect(getSession(laptop)).toBeUndefined();
    expect(getSession(phone)).toBeUndefined();
    expect(getSession(otherUser)).toBeDefined();
  });

  test("an unknown id is simply absent", () => {
    expect(getSession("not-a-session")).toBeUndefined();
    expect(() => destroySession("not-a-session")).not.toThrow();
  });
});

describe("sweeper timer", () => {
  test("does not hold the process open", async () => {
    const { startSessionSweeper } = await import("../sessions.js");
    const unref = jest.fn();

    jest
      .spyOn(global, "setInterval")
      .mockReturnValue({ unref });

    startSessionSweeper(1000);

    expect(unref).toHaveBeenCalled();

    global.setInterval.mockRestore();
  });
});
