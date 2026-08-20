import express from "express";

import { REPORT_EVENT, reportEvents } from "../lib/reportEvents.js";

// Server-Sent Events: the board updates itself.
//
// A maintenance board is read by several people at once — a resident who filed
// a ticket, whoever is fixing it — and a page rendered once at request time
// starts going stale immediately. Polling would fix that by asking a question
// nobody has an answer to, most of the time.
//
// SSE rather than WebSockets because the traffic is entirely one-directional
// (writes already have perfectly good HTTP routes) and because it needs no
// dependency, no protocol upgrade, and reconnects on its own when a laptop
// wakes up. It is plain HTTP that never finishes.

const HEARTBEAT_MS = 25000;

const router = express.Router();

router.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Proxies that buffer by default would hold each event until the response
    // ends, which for a stream is never.
    "X-Accel-Buffering": "no"
  });

  // An initial comment flushes headers, so the browser fires onopen straight
  // away instead of waiting for the first real event.
  res.write(": connected\n\n");
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`event: report\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  reportEvents.on(REPORT_EVENT, send);

  // Idle connections are dropped by proxies and by some mobile networks after
  // a minute or so. A comment line every 25s is ignored by EventSource and
  // keeps the socket demonstrably alive.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

  heartbeat.unref?.();

  const cleanup = () => {
    clearInterval(heartbeat);
    reportEvents.off(REPORT_EVENT, send);
  };

  // Both: 'close' covers the client going away, and the response's own close
  // covers the server ending the stream during shutdown. Without the listener
  // being removed, every disconnected browser would leave a dead listener
  // holding a reference to its response object.
  req.on("close", cleanup);
  res.on("close", cleanup);
});

export default router;
