// A single error shape the whole stack agrees on.
//
// Before this, the layers disagreed: the service threw plain Errors and
// smuggled a status code onto one of them as an ad-hoc `.status` property,
// while each controller invented its own mapping from "something threw" to an
// HTTP response. An error that nobody had thought about became a 404, because
// 404 was the fallback that happened to be typed in reportController.

export class HttpError extends Error {
  constructor(status, message, { expose = status < 500, code } = {}) {
    super(message);

    this.name = "HttpError";
    this.status = status;
    // Whether this message is safe to show the caller. Internal failures are
    // logged in full and reported generically, so a stack trace or a driver
    // message never reaches the browser.
    this.expose = expose;
    this.code = code;
  }
}

export const badRequest = (message, options) =>
  new HttpError(400, message, options);

export const unauthorized = (message = "Login required.", options) =>
  new HttpError(401, message, options);

export const forbidden = (message = "Forbidden.", options) =>
  new HttpError(403, message, options);

export const notFound = (message = "Not found.", options) =>
  new HttpError(404, message, options);

export const tooManyRequests = (message, options) =>
  new HttpError(429, message, options);
