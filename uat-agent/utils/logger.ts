const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /4[0-9]{15}/g, replacement: "[CARD]" },
  { pattern: /sk_test_[a-zA-Z0-9]+/g, replacement: "[STRIPE_KEY]" },
  { pattern: /pk_test_[a-zA-Z0-9]+/g, replacement: "[STRIPE_KEY]" },
  { pattern: /password[:=]\s*["']?[^\s"',]+/gi, replacement: "password=[MASKED]" },
];

function mask(input: string): string {
  let result = input;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

function timestamp(): string {
  return new Date().toISOString();
}

export const uatLogger = {
  info(message: string, ...args: unknown[]): void {
    const masked = mask(message);
    console.log(`[UAT ${timestamp()}] INFO  ${masked}`, ...args);
  },

  step(scenario: string, stepNum: number, action: string, detail?: string): void {
    const d = detail ? ` → ${mask(detail)}` : "";
    console.log(`[UAT ${timestamp()}] STEP  [${scenario}] #${stepNum} ${action}${d}`);
  },

  pass(message: string): void {
    console.log(`[UAT ${timestamp()}] ✓ PASS ${mask(message)}`);
  },

  fail(message: string, error?: string): void {
    const e = error ? ` — ${mask(error)}` : "";
    console.error(`[UAT ${timestamp()}] ✗ FAIL ${mask(message)}${e}`);
  },

  warn(message: string): void {
    console.warn(`[UAT ${timestamp()}] WARN  ${mask(message)}`);
  },

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err ?? "");
    console.error(`[UAT ${timestamp()}] ERROR ${mask(message)}`, detail ? mask(detail) : "");
  },

  divider(): void {
    console.log("─".repeat(60));
  },

  banner(text: string): void {
    console.log("\n" + "═".repeat(60));
    console.log(`  ${text}`);
    console.log("═".repeat(60) + "\n");
  },
};
