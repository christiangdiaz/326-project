import path from "node:path";

import express from "express";
import cookieParser from "cookie-parser";

import reportRoutes from "./routes/reports.js";
import authRoutes from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import apiRoutes from "./routes/api.js";
import eventRoutes from "./routes/events.js";

import { attachUser } from "./middleware/attachUser.js";
import { csrfProtection } from "./middleware/csrf.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import {
  createErrorHandler,
  notFoundHandler
} from "./middleware/errorHandler.js";

import { config as defaultConfig } from "./config/env.js";

// The Express app, built and returned rather than started.
//
// server.js used to do both: wire the app and open a socket and connect to
// Mongo, all at import time. That made the app impossible to exercise without
// a database and a listening port, so every test had to stop at the service
// layer — the middleware chain, the routes and the wiring between them were
// untested by construction. A factory that takes its configuration as an
// argument can be built per test, with whatever configuration that test needs.

export function createApp({ config = defaultConfig } = {}) {
  const app = express();

  // Advertising the framework in every response is free reconnaissance.
  app.disable("x-powered-by");

  if (config.trustProxy) {
    app.set("trust proxy", config.trustProxy);
  }

  app.set("view engine", "ejs");
  app.set("views", path.join(import.meta.dirname, "views"));

  app.use(securityHeaders({ isProduction: config.isProduction }));

  app.use(
    express.static(path.join(import.meta.dirname, "public"), {
      // Fingerprinting is out of scope, so the built CSS and the vendored
      // htmx bundle are revalidated rather than cached blind.
      maxAge: config.isProduction ? "1h" : 0
    })
  );

  // Mounted ahead of the session middleware so nothing to do with
  // authentication can sit between a monitor and the answer to "is this
  // process up?".
  app.use(healthRoutes);

  // Explicit limits. The defaults are generous enough that an unauthenticated
  // request can make the process parse a payload far larger than any form on
  // this site could produce.
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));

  app.use(cookieParser(config.sessionSecret));
  app.use(attachUser);
  app.use(csrfProtection({ secure: config.cookieSecure }));

  app.use(eventRoutes);
  app.use(authRoutes);
  app.use(apiRoutes);
  app.use(reportRoutes);

  app.use(notFoundHandler);
  app.use(
    createErrorHandler({ exposeStack: !config.isProduction && !config.isTest })
  );

  return app;
}

export default createApp;
