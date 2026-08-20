process.env.SESSION_SECRET = "test-secret-that-is-long-enough-to-pass-checks";
process.env.NODE_ENV = "test";

// Imported dynamically, not with a static `import`: static imports are hoisted
// above the assignments above, so the config module would load before the
// environment it is meant to read has been set.
const { createApp } = await import("../app.js");
const { loadConfig } = await import("../config/env.js");
const { reportEvents, REPORT_EVENT } = await import("../lib/reportEvents.js");

// The live-update stream. Worth its own suite because the failure mode is
// invisible from a normal request: a listener that is never removed keeps a
// dead response object alive for every browser that has ever connected.

let server;
let origin;

beforeAll(async () => {
  server = createApp({ config: loadConfig({ warn: () => {} }) }).listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  // An SSE response is a connection that never ends on its own, so a plain
  // close() would wait for it forever. This is the same reason server.js has
  // a shutdown timeout.
  server.closeAllConnections();

  await new Promise((resolve) => server.close(resolve));
});

// Opens the stream and resolves once `wanted` bytes-worth of events have
// arrived, so a test never waits on a stream that by design never ends.
async function openStream() {
  const controller = new AbortController();

  const response = await fetch(`${origin}/events`, {
    signal: controller.signal,
    headers: { Accept: "text/event-stream" }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  return {
    response,
    close: () => controller.abort(),
    async next() {
      // Skips heartbeat and handshake comments, which are not events.
      for (;;) {
        const { value, done } = await reader.read();

        if (done) return null;

        const chunk = decoder.decode(value);
        const match = chunk.match(/^data: (.*)$/m);

        if (match) return JSON.parse(match[1]);
      }
    }
  };
}

test("the stream announces itself as SSE and is not cached", async () => {
  const stream = await openStream();

  expect(stream.response.status).toBe(200);
  expect(stream.response.headers.get("content-type")).toContain(
    "text/event-stream"
  );
  expect(stream.response.headers.get("cache-control")).toContain("no-cache");

  stream.close();
});

test("a report change reaches a connected client", async () => {
  const stream = await openStream();

  // Give the server a tick to register the listener before emitting.
  await new Promise((resolve) => setImmediate(resolve));

  reportEvents.emitChange("created", {
    _id: "abc",
    unit: "2C",
    description: "Leaky sink",
    status: "Open"
  });

  await expect(stream.next()).resolves.toEqual({
    action: "created",
    report: {
      id: "abc",
      unit: "2C",
      description: "Leaky sink",
      status: "Open"
    }
  });

  stream.close();
});

// A connection opening and a connection being reaped are both observed by the
// server asynchronously, so every assertion about the listener count polls
// rather than guessing at a delay.
async function waitForListeners(count) {
  for (let i = 0; i < 100; i += 1) {
    if (reportEvents.listenerCount(REPORT_EVENT) === count) return true;

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return false;
}

test("a disconnected client leaves no listener behind", async () => {
  // Earlier tests in this file close their streams; wait for those to be
  // reaped so the baseline is the real one.
  await waitForListeners(0);

  const stream = await openStream();

  expect(await waitForListeners(1)).toBe(true);

  stream.close();

  expect(await waitForListeners(0)).toBe(true);
});
