import { HttpError, notFound } from "../lib/httpError.js";
import { logger as defaultLogger } from "../lib/logger.js";

// One place where an error becomes a response.
//
// Controllers hand errors to next() and stop thinking about them. Express 5
// forwards a rejected promise from an async handler here automatically, so a
// route that throws unexpectedly gets the same treatment as one that fails
// deliberately — previously that combination produced an unhandled rejection
// and a request that simply hung.

export function notFoundHandler(req, res, next) {
  next(notFound(`Cannot ${req.method} ${req.path}`));
}

// Negotiates on the request rather than the route: the same failure has to be
// an HTML page for a form post and JSON for an API call or an htmx request.
function wantsJson(req) {
  if (req.path.startsWith("/api/")) return true;
  if (req.get("hx-request")) return false;

  return req.accepts(["html", "json"]) === "json";
}

export function createErrorHandler({
  logger = defaultLogger,
  exposeStack = false
} = {}) {
  // Four arguments on purpose: Express identifies an error handler by its
  // arity, and dropping `next` would silently turn this into ordinary
  // middleware that never runs.
  return function handleError(error, req, res, next) {
    const status =
      error instanceof HttpError
        ? error.status
        : Number.isInteger(error?.status)
          ? error.status
          : 500;

    // Anything the app did not deliberately raise is a bug, and its message
    // may quote a database error or a file path. Log it in full, tell the
    // caller nothing beyond the status.
    const safeMessage =
      error?.expose === true || (status < 500 && error?.message)
        ? error.message
        : "Something went wrong. Please try again.";

    logger[status >= 500 ? "error" : "warn"]("request failed", {
      status,
      method: req.method,
      path: req.path,
      code: error?.code,
      error
    });

    if (res.headersSent) {
      // A stream (the SSE endpoint) or a partially flushed render. Nothing
      // useful can be added to the response body, so end it rather than let
      // Express append an error page to whatever the client already has.
      return res.end();
    }

    res.status(status);

    if (wantsJson(req)) {
      return res.json({
        error: safeMessage,
        code: error?.code,
        ...(exposeStack && status >= 500 ? { stack: error?.stack } : {})
      });
    }

    // htmx swaps only on 2xx, so an error response body is never rendered into
    // the page; plain text keeps it readable in the network tab and in tests.
    if (req.get("hx-request")) {
      res.type("text/plain");
      return res.send(safeMessage);
    }

    // A failure early enough in the chain — a malformed JSON body, a payload
    // over the limit — happens before the CSRF middleware has run, so the
    // token the shared header partial renders does not exist yet. Without
    // this, rendering the error page throws its own error.
    res.locals.csrfToken ??= "";

    res.render("error", { status, message: safeMessage, user: req.user });
  };
}
