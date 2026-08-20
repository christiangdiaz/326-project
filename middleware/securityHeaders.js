// Response headers that constrain what a browser will do with this page.
//
// Written out rather than pulled from Helmet: the whole set is six headers,
// every one of them is a decision worth seeing in the diff, and the
// Content-Security-Policy below is only enforceable because the app stopped
// loading htmx from a third-party CDN. `script-src 'self'` is the header that
// turns "we vendored a script" into an actual guarantee.

const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  // The SSE stream and htmx requests are same-origin; nothing else may be
  // contacted from the page, so exfiltration by injected script has no route.
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'"
].join("; ");

export function securityHeaders({ isProduction = false } = {}) {
  return function applySecurityHeaders(req, res, next) {
    res.setHeader("Content-Security-Policy", POLICY);
    // Stops a browser from second-guessing a Content-Type, which is how a
    // user-supplied upload becomes executable script.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), interest-cohort=()"
    );

    // HSTS only over TLS: sending it on a plain-http development server asks
    // the browser to remember a rule the dev server cannot satisfy.
    if (isProduction) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    // Express advertises itself by default. Naming the framework and stack to
    // anyone who sends a request is free reconnaissance for no benefit.
    res.removeHeader("X-Powered-By");

    next();
  };
}
