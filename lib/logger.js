// Structured logging.
//
// console.log with an interpolated string is fine to read in a terminal and
// useless everywhere else: a log aggregator cannot filter on it, and the
// health probe and the request log end up in the same undifferentiated stream.
// One line of JSON per event costs nothing here and keeps both audiences.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function serialize(level, message, fields) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields
  };

  if (fields?.error instanceof Error) {
    entry.error = {
      name: fields.error.name,
      message: fields.error.message,
      stack: fields.error.stack
    };
  }

  return JSON.stringify(entry);
}

export function createLogger({
  level = process.env.LOG_LEVEL || "info",
  // Silenced under Jest so a deliberately provoked 500 in a test does not
  // print a stack trace that looks like a real failure.
  enabled = process.env.NODE_ENV !== "test",
  write = (line) => process.stdout.write(`${line}\n`)
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const log = (name) => (message, fields) => {
    if (!enabled || LEVELS[name] < threshold) return;

    write(serialize(name, message, fields));
  };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error")
  };
}

export const logger = createLogger();
