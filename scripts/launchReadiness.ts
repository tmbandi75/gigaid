import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

type CheckStatus = "pass" | "fail" | "warn" | "skip";
type CheckCategory = "AUTOMATED_CHECKS" | "CONFIG_CHECKS" | "MANUAL_CHECKS_REQUIRED";

interface CheckResult {
  name: string;
  status: CheckStatus;
  category: CheckCategory;
  message: string;
  duration_ms?: number;
  details?: string;
}

interface LaunchReport {
  generated_at: string;
  total_duration_ms: number;
  overall_status: "READY" | "NOT_READY" | "NEEDS_MANUAL_REVIEW";
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  sections: {
    AUTOMATED_CHECKS: CheckResult[];
    CONFIG_CHECKS: CheckResult[];
    MANUAL_CHECKS_REQUIRED: CheckResult[];
  };
  fail_fast_triggered: boolean;
  fail_fast_reason?: string;
}

const TEST_LAYERS = [
  { name: "test:core", command: "npx jest --selectProjects api --forceExit", label: "Core API Tests" },
  { name: "test:e2e", command: "npx playwright test", label: "End-to-End Tests" },
  { name: "test:revenue", command: "npx jest --selectProjects api --testPathPattern='revenue\\.' --forceExit", label: "Revenue Tests" },
  { name: "test:capability", command: "npx jest --selectProjects api --testPathPattern='capabilities\\.' --forceExit", label: "Capability Tests" },
  { name: "test:offline", command: "", label: "Offline Tests" },
  { name: "test:upgrade", command: "npx jest --selectProjects api --testPathPattern='activation\\.' --forceExit", label: "Upgrade Tests" },
  { name: "test:downgrade", command: "", label: "Downgrade Tests" },
];

const REQUIRED_ENV_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "JWT_SECRET",
];

const STRIPE_VERIFICATION_FILES = [
  "server/stripeWebhookRoutes.ts",
  "server/routes.ts",
];

const LEGAL_ROUTES = [
  { name: "Privacy Policy", patterns: ["/privacy", "privacy.tsx", "PrivacyPolicy"] },
  { name: "Terms of Service", patterns: ["/terms", "terms.tsx", "TermsOfService"] },
];

const RATE_LIMIT_PATTERNS = ["rateLimit", "rateLimiter", "rate_limit", "rate-limit"];

const MONITORING_FILES = {
  sentryConfig: ["sentry.ts", "sentry.config.ts", "sentry.client.config.ts", "sentry.server.config.ts"],
  errorHandler: ["errorHandler.ts", "errorMiddleware.ts", "error-handler.ts"],
};

const BACKUP_PATTERNS = ["backup", "pg_dump", "cron", "backup.sh", "backup.ts"];

function log(msg: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] ${msg}`);
}

function logSection(title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

function logResult(result: CheckResult): void {
  const icon = result.status === "pass" ? "OK" : result.status === "fail" ? "FAIL" : result.status === "warn" ? "WARN" : "SKIP";
  const pad = icon.length < 4 ? " ".repeat(4 - icon.length) : "";
  console.log(`  [${icon}]${pad} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`         ${result.details}`);
  }
}

function runCommand(cmd: string, timeoutMs = 120_000): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    const output = (err.stdout || "") + "\n" + (err.stderr || "");
    return { success: false, output: output.trim() };
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), filePath));
}

function fileContains(filePath: string, patterns: string[]): boolean {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return false;
  const content = fs.readFileSync(resolved, "utf-8");
  return patterns.some((p) => content.includes(p));
}

function searchFilesForPattern(dir: string, patterns: string[], extensions = [".ts", ".tsx", ".js"]): string[] {
  const matches: string[] = [];
  const resolved = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(resolved)) return matches;

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(full);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        try {
          const content = fs.readFileSync(full, "utf-8");
          if (patterns.some((p) => content.includes(p))) {
            matches.push(path.relative(process.cwd(), full));
          }
        } catch {}
      }
    }
  }
  walk(resolved);
  return matches;
}

function runTestLayer(layer: typeof TEST_LAYERS[number]): CheckResult {
  const start = Date.now();

  if (!layer.command) {
    return {
      name: layer.label,
      status: "skip",
      category: "AUTOMATED_CHECKS",
      message: `No tests configured yet for "${layer.name}"`,
      duration_ms: Date.now() - start,
      details: "Add test files and update TEST_LAYERS command to enable this check",
    };
  }

  log(`Running ${layer.label}...`);
  const result = runCommand(layer.command, 180_000);
  const duration = Date.now() - start;

  if (result.success) {
    return {
      name: layer.label,
      status: "pass",
      category: "AUTOMATED_CHECKS",
      message: `All tests passed`,
      duration_ms: duration,
    };
  }

  const lastLines = result.output.split("\n").slice(-10).join("\n");
  return {
    name: layer.label,
    status: "fail",
    category: "AUTOMATED_CHECKS",
    message: `Tests failed`,
    duration_ms: duration,
    details: lastLines,
  };
}

function checkDatabaseReset(): CheckResult {
  const start = Date.now();
  const hasDbPush = fileExists("drizzle.config.ts") || fileContains("package.json", ["db:push"]);
  if (hasDbPush) {
    return {
      name: "Database Reset",
      status: "pass",
      category: "AUTOMATED_CHECKS",
      message: "db:push script available for schema sync",
      duration_ms: Date.now() - start,
    };
  }

  return {
    name: "Database Reset",
    status: "warn",
    category: "AUTOMATED_CHECKS",
    message: "No database reset script found",
    duration_ms: Date.now() - start,
    details: "Consider adding db:push or db:reset script",
  };
}

function checkEnvVars(): CheckResult[] {
  const results: CheckResult[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const exists = !!process.env[envVar];
    results.push({
      name: `Env: ${envVar}`,
      status: exists ? "pass" : "fail",
      category: "CONFIG_CHECKS",
      message: exists ? "Set" : "MISSING - required for launch",
    });
  }

  return results;
}

function checkSentryDSN(): CheckResult {
  const hasSentryEnv = !!process.env.SENTRY_DSN || !!process.env.VITE_SENTRY_DSN;
  const sentryFiles = MONITORING_FILES.sentryConfig.filter((f) =>
    fileExists(f) || fileExists(`server/${f}`) || fileExists(`client/src/${f}`)
  );
  const sentryInCode = searchFilesForPattern("server", ["@sentry/node", "Sentry.init"]);
  const sentryInClient = searchFilesForPattern("client/src", ["@sentry/react", "Sentry.init"]);

  const found = hasSentryEnv || sentryFiles.length > 0 || sentryInCode.length > 0 || sentryInClient.length > 0;

  if (found) {
    return {
      name: "Sentry DSN",
      status: "pass",
      category: "CONFIG_CHECKS",
      message: "Sentry integration detected",
      details: sentryInCode.concat(sentryInClient).join(", ") || "Via environment variable",
    };
  }

  return {
    name: "Sentry DSN",
    status: "warn",
    category: "MANUAL_CHECKS_REQUIRED",
    message: "No Sentry integration detected",
    details: "Set SENTRY_DSN env var or add @sentry/node to enable error tracking",
  };
}

function checkErrorHandler(): CheckResult {
  const handlerFiles = MONITORING_FILES.errorHandler.filter((f) =>
    fileExists(f) || fileExists(`server/${f}`) || fileExists(`server/middleware/${f}`)
  );
  const codeMatches = searchFilesForPattern("server", ["app.use(errorHandler", "app.use(handleErrors", "error_handler"]);

  if (handlerFiles.length > 0 || codeMatches.length > 0) {
    return {
      name: "Error Handler Middleware",
      status: "pass",
      category: "CONFIG_CHECKS",
      message: "Error handler middleware detected",
      details: handlerFiles.concat(codeMatches).join(", "),
    };
  }

  return {
    name: "Error Handler Middleware",
    status: "warn",
    category: "MANUAL_CHECKS_REQUIRED",
    message: "No dedicated error handler middleware found",
    details: "Consider adding centralized error handling middleware",
  };
}

function checkLegalRoutes(): CheckResult[] {
  const results: CheckResult[] = [];

  for (const route of LEGAL_ROUTES) {
    const appFile = path.resolve(process.cwd(), "client/src/App.tsx");
    let found = false;

    if (fs.existsSync(appFile)) {
      const content = fs.readFileSync(appFile, "utf-8");
      found = route.patterns.some((p) => content.includes(p));
    }

    if (!found) {
      const pageFiles = searchFilesForPattern("client/src/pages", route.patterns);
      found = pageFiles.length > 0;
    }

    results.push({
      name: `Legal: ${route.name}`,
      status: found ? "pass" : "fail",
      category: "CONFIG_CHECKS",
      message: found ? "Route exists" : "Route NOT found - required for launch",
    });
  }

  return results;
}

function checkStripeWebhookVerification(): CheckResult {
  let found = false;
  const matchedFiles: string[] = [];

  for (const file of STRIPE_VERIFICATION_FILES) {
    if (fileContains(file, ["constructEvent", "webhooks.constructEvent"])) {
      found = true;
      matchedFiles.push(file);
    }
  }

  if (!found) {
    const codeMatches = searchFilesForPattern("server", ["constructEvent"]);
    if (codeMatches.length > 0) {
      found = true;
      matchedFiles.push(...codeMatches);
    }
  }

  return {
    name: "Stripe Webhook Signature Verification",
    status: found ? "pass" : "fail",
    category: "AUTOMATED_CHECKS",
    message: found ? "constructEvent verification present" : "MISSING - Stripe webhook signature verification not found",
    details: found ? `Found in: ${matchedFiles.join(", ")}` : "Add stripe.webhooks.constructEvent() to verify webhook signatures",
  };
}

function checkRateLimiting(): CheckResult {
  const serverMatches = searchFilesForPattern("server", RATE_LIMIT_PATTERNS);

  if (serverMatches.length > 0) {
    return {
      name: "Rate Limiting Middleware",
      status: "pass",
      category: "CONFIG_CHECKS",
      message: "Rate limiting logic detected",
      details: `Found in: ${serverMatches.join(", ")}`,
    };
  }

  return {
    name: "Rate Limiting Middleware",
    status: "warn",
    category: "MANUAL_CHECKS_REQUIRED",
    message: "No rate limiting middleware detected",
    details: "Consider adding express-rate-limit or similar",
  };
}

function checkBackups(): CheckResult {
  const excludeSelf = (files: string[]) => files.filter((f) => !f.includes("launchReadiness"));
  const backupFiles = excludeSelf(searchFilesForPattern(".", ["pg_dump", "backup.sh", "backup.ts", "db-backup"], [".sh", ".ts", ".js", ".yml", ".yaml"]));
  const hasCron = fileExists("crontab") || fileExists(".crontab") || fileExists("scripts/backup.sh");

  const allFound = [...backupFiles];

  if (allFound.length > 0 || hasCron) {
    return {
      name: "Backup Configuration",
      status: "pass",
      category: "CONFIG_CHECKS",
      message: "Backup configuration detected",
      details: `Found: ${allFound.join(", ")}`,
    };
  }

  return {
    name: "Backup Configuration",
    status: "warn",
    category: "MANUAL_CHECKS_REQUIRED",
    message: "No backup script or cron detected",
    details: "Configure automated database backups before launch",
  };
}

function generateReport(results: CheckResult[], totalDuration: number, failFast: { triggered: boolean; reason?: string }): LaunchReport {
  const sections: LaunchReport["sections"] = {
    AUTOMATED_CHECKS: [],
    CONFIG_CHECKS: [],
    MANUAL_CHECKS_REQUIRED: [],
  };

  for (const r of results) {
    sections[r.category].push(r);
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    warnings: results.filter((r) => r.status === "warn").length,
    skipped: results.filter((r) => r.status === "skip").length,
  };

  let overall: LaunchReport["overall_status"];
  if (failFast.triggered || summary.failed > 0) {
    overall = "NOT_READY";
  } else if (summary.warnings > 0) {
    overall = "NEEDS_MANUAL_REVIEW";
  } else {
    overall = "READY";
  }

  return {
    generated_at: new Date().toISOString(),
    total_duration_ms: totalDuration,
    overall_status: overall,
    summary,
    sections,
    fail_fast_triggered: failFast.triggered,
    fail_fast_reason: failFast.reason,
  };
}

function writeReport(report: LaunchReport): string {
  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, "launch-readiness.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  return reportPath;
}

async function main() {
  const globalStart = Date.now();
  const results: CheckResult[] = [];
  const failFast = { triggered: false, reason: undefined as string | undefined };

  console.log("\n");
  console.log("  LAUNCH READINESS AGENT");
  console.log("  " + new Date().toISOString());
  console.log("\n");

  logSection("AUTOMATED CHECKS");

  const dbResult = checkDatabaseReset();
  results.push(dbResult);
  logResult(dbResult);

  for (const layer of TEST_LAYERS) {
    const testResult = runTestLayer(layer);
    results.push(testResult);
    logResult(testResult);

    if (testResult.status === "fail") {
      failFast.triggered = true;
      failFast.reason = `Test layer "${layer.label}" failed`;
      log(`FAIL FAST: ${failFast.reason}`);
      break;
    }
  }

  const stripeResult = checkStripeWebhookVerification();
  results.push(stripeResult);
  logResult(stripeResult);

  if (stripeResult.status === "fail" && !failFast.triggered) {
    failFast.triggered = true;
    failFast.reason = "Stripe webhook signature verification missing";
    log(`FAIL FAST: ${failFast.reason}`);
  }

  logSection("CONFIG CHECKS");

  const envResults = checkEnvVars();
  for (const r of envResults) {
    results.push(r);
    logResult(r);
    if (r.status === "fail" && !failFast.triggered) {
      failFast.triggered = true;
      failFast.reason = `Critical environment variable missing: ${r.name}`;
      log(`FAIL FAST: ${failFast.reason}`);
    }
  }

  const legalResults = checkLegalRoutes();
  for (const r of legalResults) {
    results.push(r);
    logResult(r);
  }

  const rateLimitResult = checkRateLimiting();
  results.push(rateLimitResult);
  logResult(rateLimitResult);

  const backupResult = checkBackups();
  results.push(backupResult);
  logResult(backupResult);

  logSection("MANUAL CHECKS REQUIRED");

  const sentryResult = checkSentryDSN();
  results.push(sentryResult);
  logResult(sentryResult);

  const errorHandlerResult = checkErrorHandler();
  results.push(errorHandlerResult);
  logResult(errorHandlerResult);

  const totalDuration = Date.now() - globalStart;
  const report = generateReport(results, totalDuration, failFast);
  const reportPath = writeReport(report);

  logSection("SUMMARY");
  console.log(`  Status:    ${report.overall_status}`);
  console.log(`  Passed:    ${report.summary.passed}/${report.summary.total}`);
  console.log(`  Failed:    ${report.summary.failed}`);
  console.log(`  Warnings:  ${report.summary.warnings}`);
  console.log(`  Skipped:   ${report.summary.skipped}`);
  console.log(`  Duration:  ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Report:    ${reportPath}`);

  if (failFast.triggered) {
    console.log(`\n  FAIL FAST: ${failFast.reason}`);
  }

  console.log("\n");

  process.exit(report.overall_status === "NOT_READY" ? 1 : 0);
}

main().catch((err) => {
  console.error("Launch readiness agent crashed:", err);
  process.exit(2);
});
