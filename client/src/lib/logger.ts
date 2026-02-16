const isDev = import.meta.env.DEV;

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  /\b[A-Za-z0-9]{20,}\b/g,
];

function sanitize(arg: unknown): unknown {
  if (typeof arg !== "string") return arg;
  let result = arg;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map(sanitize);
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) {
      console.log("[DEBUG]", ...args);
    }
  },

  info(...args: unknown[]): void {
    if (isDev) {
      console.info("[INFO]", ...args);
    }
  },

  warn(...args: unknown[]): void {
    console.warn("[WARN]", ...sanitizeArgs(args));
  },

  error(...args: unknown[]): void {
    console.error("[ERROR]", ...sanitizeArgs(args));
  },
};
