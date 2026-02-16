import { maskPhone, maskEmail, maskUid } from "./safeLogger";

const isProduction = process.env.NODE_ENV === "production";

const PII_PATTERNS: Array<{ pattern: RegExp; replacer: (match: string) => string }> = [
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacer: (match) => maskEmail(match),
  },
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacer: (match) => maskPhone(match),
  },
  {
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacer: () => "[REDACTED-UUID]",
  },
  {
    pattern: /\b(userId|user_id|uid)\s*[:=]\s*["']?[\w-]+["']?/gi,
    replacer: () => "[REDACTED-UID]",
  },
  {
    pattern: /\b(token|bearer|authorization)\s*[:=]\s*["']?[\w.-]+["']?/gi,
    replacer: () => "[REDACTED-TOKEN]",
  },
];

function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const { pattern, replacer } of PII_PATTERNS) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacer);
    }
    return result;
  }
  if (value instanceof Error) {
    const scrubbed = new Error(scrub(value.message) as string);
    scrubbed.stack = value.stack ? (scrub(value.stack) as string) : undefined;
    return scrubbed;
  }
  if (typeof value === "object" && value !== null) {
    try {
      return scrub(JSON.stringify(value));
    } catch {
      return "[unserializable]";
    }
  }
  return value;
}

function scrubArgs(args: unknown[]): unknown[] {
  return args.map(scrub);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug(...args: unknown[]): void {
    if (!isProduction) {
      console.log(`[DEBUG ${formatTimestamp()}]`, ...args);
    }
  },

  info(...args: unknown[]): void {
    if (isProduction) {
      console.log(`[INFO ${formatTimestamp()}]`, ...scrubArgs(args));
    } else {
      console.log(`[INFO ${formatTimestamp()}]`, ...args);
    }
  },

  warn(...args: unknown[]): void {
    console.warn(`[WARN ${formatTimestamp()}]`, ...scrubArgs(args));
  },

  error(...args: unknown[]): void {
    console.error(`[ERROR ${formatTimestamp()}]`, ...scrubArgs(args));
  },
};

export { maskPhone, maskEmail, maskUid } from "./safeLogger";
