import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, relative } from "path";
import { sync as globSync } from "glob";
import {
  parse,
  AST_NODE_TYPES,
  TSESTree,
} from "@typescript-eslint/typescript-estree";

const ROOT = join(__dirname, "..", "..");
const CLIENT_SRC = join(ROOT, "client", "src");
const SERVER_DIR = join(ROOT, "server");
const SHARED_DIR = join(ROOT, "shared");
// PDF / CSV / printable-document builders historically lived in `reports/`
// and `exports/`. Today they only hold JSON / PNG artifacts, but Task #183
// extends the safe-price gate over those directories so any future TS/TSX
// builder added there is rejected the moment it concatenates raw `$`.
const REPORTS_DIR = join(ROOT, "reports");
const EXPORTS_DIR = join(ROOT, "exports");
// Test fixtures and Playwright e2e specs (Task #178). Catches raw `$`
// formatting hidden in fixture/seed data that could later be copy-pasted
// into product code.
const TESTS_DIR = join(ROOT, "tests");
const E2E_DIR = join(ROOT, "e2e");

// The helper itself is the *one* place raw `$` prefix patterns are
// allowed — that is the whole point of the helper. Every other surface
// (UI, emails, SMS, PDFs, webhook payloads) goes through it.
//
// The `tests/monetization/stripe-tests.ts` entry is an unavoidable
// fixture violation: it builds human-readable plan-price labels
// (e.g. "Pro plan price is $19/mo") for the monetization test report.
// Values come from `PLAN_PRICES_CENTS`, never user input, and the strings
// are not rendered to end users — they're console/JSON test output only.
// Mirrors the matching entry in `eslint-rules/no-raw-price-format.cjs`.
const ALLOWLIST = new Set<string>([
  "client/src/lib/safePrice.ts",
  "shared/safePrice.ts",
  "tests/monetization/stripe-tests.ts",
]);

type ViolationKind =
  | "template-literal"
  | "jsx-text"
  | "string-concat";

interface Violation {
  file: string;
  line: number;
  column: number;
  kind: ViolationKind;
  snippet: string;
}

function endsWithDollar(value: string): boolean {
  return /\$\s*$/.test(value);
}

function isStringLiteralEndingInDollar(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return endsWithDollar(node.value);
  }
  if (node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0) {
    const only = node.quasis[0];
    return endsWithDollar(only.value.cooked ?? only.value.raw);
  }
  return false;
}

function buildViolation(
  file: string,
  loc: TSESTree.SourceLocation | undefined,
  kind: ViolationKind,
  source: string,
): Violation {
  const line = loc?.end.line ?? 0;
  const column = loc?.end.column ?? 0;
  const snippetLine = source.split("\n")[line - 1] ?? "";
  return {
    file,
    line,
    column,
    kind,
    snippet: snippetLine.trim().slice(0, 160),
  };
}

function visit(node: TSESTree.Node, fn: (n: TSESTree.Node) => void): void {
  fn(node);
  for (const key of Object.keys(node) as Array<keyof TSESTree.Node>) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const value = (node as Record<string, unknown>)[key as string];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && typeof (item as { type?: unknown }).type === "string") {
          visit(item as TSESTree.Node, fn);
        }
      }
    } else if (
      value &&
      typeof value === "object" &&
      typeof (value as { type?: unknown }).type === "string"
    ) {
      visit(value as TSESTree.Node, fn);
    }
  }
}

function scanFile(absPath: string): Violation[] {
  const code = readFileSync(absPath, "utf8");
  const violations: Violation[] = [];
  const relPath = relative(ROOT, absPath).split(/[\\/]/).join("/");

  let ast: TSESTree.Program;
  try {
    ast = parse(code, {
      jsx: true,
      loc: true,
      range: true,
      errorOnUnknownASTType: false,
      tokens: false,
      comment: false,
    });
  } catch {
    return violations;
  }

  visit(ast, (node: TSESTree.Node) => {
    // (1) Template literal with a quasi ending in `$` followed by an interpolation:
    //     `... $${value} ...`
    if (node.type === AST_NODE_TYPES.TemplateLiteral) {
      for (let i = 0; i < node.quasis.length - 1; i++) {
        const q = node.quasis[i];
        const raw = q.value.raw;
        if (endsWithDollar(raw)) {
          violations.push(buildViolation(relPath, q.loc, "template-literal", code));
        }
      }
      return;
    }

    // (2) JSX text ending in `$` immediately before a `{...}` expression:
    //     <span>${value}</span>
    if (
      node.type === AST_NODE_TYPES.JSXElement ||
      node.type === AST_NODE_TYPES.JSXFragment
    ) {
      const children = node.children;
      for (let i = 0; i < children.length - 1; i++) {
        const child = children[i];
        const next = children[i + 1];
        if (
          child.type === AST_NODE_TYPES.JSXText &&
          next.type === AST_NODE_TYPES.JSXExpressionContainer &&
          endsWithDollar(child.value)
        ) {
          violations.push(buildViolation(relPath, child.loc, "jsx-text", code));
        }
      }
      return;
    }

    // (3) String concatenation that prefixes `$`:
    //     "$" + value, "Price: $" + value, ["$", value].join("")
    if (node.type === AST_NODE_TYPES.BinaryExpression && node.operator === "+") {
      if (
        isStringLiteralEndingInDollar(node.left) &&
        node.right.type !== AST_NODE_TYPES.Literal
      ) {
        violations.push(buildViolation(relPath, node.loc, "string-concat", code));
      }
      return;
    }

    // (4) Array `.join` form: ["$", value].join("...")
    if (
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee.type === AST_NODE_TYPES.MemberExpression &&
      node.callee.property.type === AST_NODE_TYPES.Identifier &&
      node.callee.property.name === "join" &&
      node.callee.object.type === AST_NODE_TYPES.ArrayExpression
    ) {
      const elements = node.callee.object.elements;
      for (const el of elements) {
        if (el && el.type !== AST_NODE_TYPES.SpreadElement && isStringLiteralEndingInDollar(el)) {
          violations.push(buildViolation(relPath, node.loc, "string-concat", code));
          break;
        }
      }
      return;
    }
  });

  return violations;
}

function scanRoot(root: string): Violation[] {
  const files = globSync("**/*.{ts,tsx}", {
    cwd: root,
    absolute: true,
    ignore: ["**/*.d.ts"],
  });

  expect(files.length).toBeGreaterThan(0);

  const violations: Violation[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file).split(/[\\/]/).join("/");
    if (ALLOWLIST.has(rel)) continue;
    violations.push(...scanFile(file));
  }
  return violations;
}

// Same shape as `scanRoot`, but tolerates an empty / missing directory.
// `reports/` and `exports/` currently only contain JSON / PNG artifacts, so
// asserting on file count would make the gate flap whenever those dirs are
// pruned. The dedicated synthetic write+scan tests below prove the wiring
// still picks up any TS/TSX builder that is later added under those roots.
function scanRootOptional(root: string): Violation[] {
  if (!existsSync(root)) return [];
  const files = globSync("**/*.{ts,tsx}", {
    cwd: root,
    absolute: true,
    ignore: ["**/*.d.ts"],
  });

  const violations: Violation[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file).split(/[\\/]/).join("/");
    if (ALLOWLIST.has(rel)) continue;
    violations.push(...scanFile(file));
  }
  return violations;
}

function reportViolations(label: string, violations: Violation[]): void {
  if (violations.length === 0) return;
  const formatted = violations
    .map(
      (v) =>
        `  [${v.kind}] ${v.file}:${v.line}:${v.column}\n      ${v.snippet}`,
    )
    .join("\n");
  throw new Error(
    `Found ${violations.length} raw price formatting violation(s) in ${label}.\n` +
      `Use safePrice / safePriceCents / safePriceCentsExact / safePriceExact / ` +
      `safePriceCentsLocale / safePriceLocale / safePriceRange / formatCurrency ` +
      `from @shared/safePrice (or @/lib/safePrice on the client) instead:\n` +
      formatted,
  );
}

describe("safe price helper enforcement", () => {
  it("rejects raw `$` prefix patterns in client/src", () => {
    reportViolations("client/src", scanRoot(CLIENT_SRC));
  });

  it("rejects raw `$` prefix patterns in server/", () => {
    reportViolations("server/", scanRoot(SERVER_DIR));
  });

  it("rejects raw `$` prefix patterns in shared/", () => {
    reportViolations("shared/", scanRoot(SHARED_DIR));
  });

  // PDF / CSV / printable-document builders (Task #183). `reports/` and
  // `exports/` may legitimately be empty of TS/TSX code today (they hold
  // generated JSON / PNG artifacts), but the gate still walks them so that
  // any future invoice / accountant export builder added there is rejected
  // the moment it concatenates raw `$NaN` / `$undefined` strings.
  it("rejects raw `$` prefix patterns in reports/", () => {
    reportViolations("reports/", scanRootOptional(REPORTS_DIR));
  });

  it("rejects raw `$` prefix patterns in exports/", () => {
    reportViolations("exports/", scanRootOptional(EXPORTS_DIR));
  });

  it("rejects raw `$` prefix patterns in tests/", () => {
    reportViolations("tests/", scanRoot(TESTS_DIR));
  });

  it("rejects raw `$` prefix patterns in e2e/", () => {
    reportViolations("e2e/", scanRoot(E2E_DIR));
  });

  it("detects a synthetic template-literal violation", () => {
    const tmp = join(CLIENT_SRC, "__synthetic_violation_test_tl__.ts");
    writeFileSync(tmp, "const x = 5;\nconst s = `$${x}`;\n", "utf8");
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "template-literal")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic JSX-text violation", () => {
    const tmp = join(CLIENT_SRC, "__synthetic_violation_test_jsx__.tsx");
    writeFileSync(
      tmp,
      "export const X = () => (<div>${(5 / 100).toFixed(2)}</div>);\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "jsx-text")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic `\"$\" + value` concatenation violation", () => {
    const tmp = join(CLIENT_SRC, "__synthetic_violation_test_concat__.ts");
    writeFileSync(tmp, 'const v = 5;\nconst s = "$" + v;\n', "utf8");
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "string-concat")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic array-join violation", () => {
    const tmp = join(CLIENT_SRC, "__synthetic_violation_test_join__.ts");
    writeFileSync(tmp, 'const v = 5;\nconst s = ["$", v].join("");\n', "utf8");
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "string-concat")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // Server-side regression coverage: the same patterns must be rejected when
  // they appear in `server/` notification template files (SMS / email bodies,
  // webhook payloads, etc.). These synthetic files are written into `server/`
  // to prove the AST scanner covers that directory and that the per-directory
  // wiring in `scanRoot(SERVER_DIR)` is intact.
  it("detects a synthetic template-literal violation in a server SMS template", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_sms_tl__.ts");
    writeFileSync(
      tmp,
      "export function buildSmsBody(amountCents: number) {\n" +
        "  return `Your invoice total is $${(amountCents / 100).toFixed(2)}.`;\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "template-literal")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic `\"$\" + value` violation in a server email template", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_email_concat__.ts");
    writeFileSync(
      tmp,
      "export function buildEmailBody(amount: number) {\n" +
        '  return "Thanks for paying $" + amount + " today.";\n' +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "string-concat")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic array-join violation in a server template", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_template_join__.ts");
    writeFileSync(
      tmp,
      "export function buildLine(amount: number) {\n" +
        '  return ["Total ", "$", amount].join("");\n' +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "string-concat")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // End-to-end wiring check: write a violating file into `server/` and
  // assert that the directory-level `scanRoot(SERVER_DIR)` call (the same
  // call used by the "rejects raw `$` prefix patterns in server/" test) picks
  // it up. This guards against an accidental future change that drops
  // `server/` from the scan scope without the dedicated server-directory
  // suite catching it.
  it("scanRoot(SERVER_DIR) picks up a synthetic server-side violation", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_scanroot__.ts");
    const relTmp = "server/__synthetic_violation_test_scanroot__.ts";
    writeFileSync(
      tmp,
      "export function buildSmsBody(amountCents: number) {\n" +
        "  return `Total: $${amountCents / 100}.`;\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanRoot(SERVER_DIR);
      expect(
        violations.some(
          (v) => v.file === relTmp && v.kind === "template-literal",
        ),
      ).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // End-to-end wiring check for `tests/`: write a violating file into the
  // `tests/` tree (mimicking a fixture or seed) and assert the directory-level
  // `scanRoot(TESTS_DIR)` call picks it up. Guards against an accidental
  // regression of Task #178 where someone drops `tests/` from the scope.
  it("scanRoot(TESTS_DIR) picks up a synthetic tests-tree violation", () => {
    const tmp = join(TESTS_DIR, "__synthetic_violation_test_tests_scanroot__.ts");
    const relTmp = "tests/__synthetic_violation_test_tests_scanroot__.ts";
    writeFileSync(
      tmp,
      "export function fixturePriceLabel(amountCents: number) {\n" +
        "  return `Total: $${amountCents / 100}.`;\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanRoot(TESTS_DIR);
      expect(
        violations.some(
          (v) => v.file === relTmp && v.kind === "template-literal",
        ),
      ).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // End-to-end wiring check for `e2e/`: same idea as above, but for the
  // Playwright e2e tree which historically wasn't covered by the gate.
  it("scanRoot(E2E_DIR) picks up a synthetic e2e-tree violation", () => {
    const tmp = join(E2E_DIR, "__synthetic_violation_test_e2e_scanroot__.ts");
    const relTmp = "e2e/__synthetic_violation_test_e2e_scanroot__.ts";
    writeFileSync(
      tmp,
      "export function expectedPriceLabel(amountCents: number) {\n" +
        '  return "Total $" + (amountCents / 100);\n' +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanRoot(E2E_DIR);
      expect(
        violations.some(
          (v) => v.file === relTmp && v.kind === "string-concat",
        ),
      ).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // The allowlist must skip flagged files in any covered directory, not just
  // `client/src/lib/safePrice.ts` and `shared/safePrice.ts`. Asserting the
  // `tests/monetization/stripe-tests.ts` entry from ALLOWLIST is honored
  // ensures no future ALLOWLIST refactor silently drops it (which would make
  // the whole `tests/` scan fail on every push).
  it("scanRoot(TESTS_DIR) honors the allowlisted fixture file", () => {
    const violations = scanRoot(TESTS_DIR);
    const flagged = violations.filter(
      (v) => v.file === "tests/monetization/stripe-tests.ts",
    );
    expect(flagged).toEqual([]);
  });

  // Negative case: a server template that uses the safePrice helper from
  // `@shared/safePrice` must NOT trigger any violations. This guards against
  // accidental over-flagging that would force template authors to bypass the
  // helper.
  it("does not flag server templates that use the safePrice helper", () => {
    const tmp = join(SERVER_DIR, "__synthetic_clean_test_helper__.ts");
    writeFileSync(
      tmp,
      'import { safePriceCentsExact } from "@shared/safePrice";\n' +
        "export function buildSmsBody(amountCents: number) {\n" +
        "  return `Your invoice total is ${safePriceCentsExact(amountCents)}.`;\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations).toEqual([]);
    } finally {
      unlinkSync(tmp);
    }
  });

  // PDF / CSV builder regression coverage (Task #183). A bug in a UI surface
  // is annoying but visible; a `$NaN` baked into a downloaded invoice PDF
  // or accountant CSV ships out the door without anyone noticing until a
  // customer escalates. These synthetic tests prove the same AST scanner
  // catches the same patterns inside PDF / CSV builder code paths, both
  // when the builder lives under `server/` (today's reality) and when one
  // is later added to `reports/` or `exports/`.
  it("detects a synthetic raw-$ template-literal in a PDF builder under server/", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_pdf_builder__.ts");
    writeFileSync(
      tmp,
      "export function buildInvoicePdfRow(amountCents: number) {\n" +
        "  // Simulates a printable-document template that bakes the\n" +
        "  // dollar prefix in by hand instead of going through safePrice.\n" +
        "  return `Total due: $${(amountCents / 100).toFixed(2)}`;\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "template-literal")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic raw-$ concat in a CSV exporter under server/", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_csv_builder__.ts");
    writeFileSync(
      tmp,
      "export function buildCsvAmountCell(amountCents: number) {\n" +
        '  return "$" + (amountCents / 100).toFixed(2);\n' +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "string-concat")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects a synthetic raw-$ array-join in a CSV row builder under server/", () => {
    const tmp = join(SERVER_DIR, "__synthetic_violation_test_csv_join__.ts");
    writeFileSync(
      tmp,
      "export function buildCsvRow(amountCents: number) {\n" +
        '  return ["customer", ["$", amountCents / 100].join("")].join(",");\n' +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations.some((v) => v.kind === "string-concat")).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // End-to-end wiring check for the new directories. Write a violating
  // builder into `reports/` and assert that the directory-level
  // `scanRootOptional(REPORTS_DIR)` call (the same call used by the
  // "rejects raw `$` prefix patterns in reports/" test) picks it up. This
  // guards against an accidental future change that drops `reports/` or
  // `exports/` from the scan scope.
  it("scanRootOptional(REPORTS_DIR) picks up a synthetic PDF builder violation", () => {
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
    const tmp = join(REPORTS_DIR, "__synthetic_violation_test_report_pdf__.ts");
    const relTmp = "reports/__synthetic_violation_test_report_pdf__.ts";
    writeFileSync(
      tmp,
      "export function renderInvoicePdf(amountCents: number) {\n" +
        "  return `Pay $${(amountCents / 100).toFixed(2)}`;\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanRootOptional(REPORTS_DIR);
      expect(
        violations.some(
          (v) => v.file === relTmp && v.kind === "template-literal",
        ),
      ).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("scanRootOptional(EXPORTS_DIR) picks up a synthetic CSV builder violation", () => {
    if (!existsSync(EXPORTS_DIR)) mkdirSync(EXPORTS_DIR, { recursive: true });
    const tmp = join(EXPORTS_DIR, "__synthetic_violation_test_export_csv__.ts");
    const relTmp = "exports/__synthetic_violation_test_export_csv__.ts";
    writeFileSync(
      tmp,
      "export function buildCsvAmountCell(amountCents: number) {\n" +
        '  return "$" + (amountCents / 100).toFixed(2);\n' +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanRootOptional(EXPORTS_DIR);
      expect(
        violations.some(
          (v) => v.file === relTmp && v.kind === "string-concat",
        ),
      ).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // TSX parity: the directory globs include `.tsx`, so confirm the
  // scanner picks up a JSX-text-shaped violation written into one of the
  // new directories. Guards against an accidental future change that
  // narrows the new roots to `.ts` only.
  it("scanRootOptional(EXPORTS_DIR) picks up a synthetic JSX-text TSX violation", () => {
    if (!existsSync(EXPORTS_DIR)) mkdirSync(EXPORTS_DIR, { recursive: true });
    const tmp = join(EXPORTS_DIR, "__synthetic_violation_test_export_tsx__.tsx");
    const relTmp = "exports/__synthetic_violation_test_export_tsx__.tsx";
    writeFileSync(
      tmp,
      "export const InvoiceRow = ({ amountCents }: { amountCents: number }) => (\n" +
        "  <tr><td>Total</td><td>${(amountCents / 100).toFixed(2)}</td></tr>\n" +
        ");\n",
      "utf8",
    );
    try {
      const violations = scanRootOptional(EXPORTS_DIR);
      expect(
        violations.some(
          (v) => v.file === relTmp && v.kind === "jsx-text",
        ),
      ).toBe(true);
    } finally {
      unlinkSync(tmp);
    }
  });

  // Negative case for PDF / CSV builders: a printable-document template
  // that uses the safePrice helper must NOT trigger any violations, so
  // template authors are not forced to bypass the helper just because
  // their output happens to be a PDF row or a CSV cell.
  it("does not flag PDF / CSV builders that use the safePrice helper", () => {
    const tmp = join(SERVER_DIR, "__synthetic_clean_test_pdf_csv_helper__.ts");
    writeFileSync(
      tmp,
      'import { safePriceCentsExact } from "@shared/safePrice";\n' +
        "export function buildInvoicePdfRow(amountCents: number) {\n" +
        "  return `Total due: ${safePriceCentsExact(amountCents)}`;\n" +
        "}\n" +
        "export function buildCsvAmountCell(amountCents: number) {\n" +
        "  return safePriceCentsExact(amountCents);\n" +
        "}\n",
      "utf8",
    );
    try {
      const violations = scanFile(tmp);
      expect(violations).toEqual([]);
    } finally {
      unlinkSync(tmp);
    }
  });
});
