import { readFileSync, writeFileSync, unlinkSync } from "fs";
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

// The helper itself is the *one* place raw `$` prefix patterns are
// allowed — that is the whole point of the helper. Every other surface
// (UI, emails, SMS, PDFs, webhook payloads) goes through it.
const ALLOWLIST = new Set<string>([
  "client/src/lib/safePrice.ts",
  "shared/safePrice.ts",
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
});
