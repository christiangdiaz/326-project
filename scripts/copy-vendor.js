import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Copies third-party browser bundles out of node_modules and into public/.
//
// The alternative — a <script> tag pointing at a CDN — hands whoever controls
// that host the ability to run code in every visitor's session, and pins the
// app's availability to theirs. Serving the file ourselves also means the
// Content-Security-Policy can be script-src 'self' with no exceptions.
//
// The copies are committed, exactly as public/style.css is, so a clone can be
// served without a build step. Re-run with `npm run build:vendor` after
// bumping a version in package.json.

const require = createRequire(import.meta.url);

const VENDOR_DIR = path.join(import.meta.dirname, "..", "public", "vendor");

const FILES = [["htmx.org/dist/htmx.min.js", "htmx.min.js"]];

mkdirSync(VENDOR_DIR, { recursive: true });

for (const [source, name] of FILES) {
  const from = require.resolve(source);
  const to = path.join(VENDOR_DIR, name);

  copyFileSync(from, to);
  console.warn(`vendored ${name} from ${source}`);
}
