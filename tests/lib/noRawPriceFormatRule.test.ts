/**
 * @jest-environment node
 */
import { join } from "path";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";

const rule = require("../../eslint-rules/no-raw-price-format.cjs");

const ROOT = join(__dirname, "..", "..");

const tsTester = new RuleTester({
  languageOptions: {
    parser: tsParser as unknown as RuleTester.LanguageOptions["parser"],
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
});

const tsxTester = new RuleTester({
  languageOptions: {
    parser: tsParser as unknown as RuleTester.LanguageOptions["parser"],
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
});

const fileIn = (rel: string): string => join(ROOT, rel);

describe("eslint-rules/no-raw-price-format", () => {
  describe("template-literal pattern", () => {
    tsTester.run("no-raw-price-format (template-literal)", rule, {
      valid: [
        {
          name: "template literal without `$` prefix is fine",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const v = 5;\nconst s = `Total ${v}`;\n",
        },
        {
          name: "template literal where `$` appears far from the interpolation is fine",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const v = 5;\nconst s = `$ amount, then a word ${v}`;\n",
        },
      ],
      invalid: [
        {
          name: "raw `$${value}` is rejected",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const v = 5;\nconst s = `$${v}`;\n",
          errors: [{ messageId: "templateLiteral" }],
        },
        {
          name: "raw `Price: $${value}` is rejected",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const v = 5;\nconst s = `Price: $${v}`;\n",
          errors: [{ messageId: "templateLiteral" }],
        },
        {
          name: "trailing whitespace after `$` still counts (regex is /\\$\\s*$/)",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const v = 5;\nconst s = `Total $ ${v}`;\n",
          errors: [{ messageId: "templateLiteral" }],
        },
        {
          name: "multiple violations in one literal report multiple times",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const a = 1;\nconst b = 2;\nconst s = `$${a} and $${b}`;\n",
          errors: [
            { messageId: "templateLiteral" },
            { messageId: "templateLiteral" },
          ],
        },
      ],
    });
  });

  describe("jsx-text pattern", () => {
    tsxTester.run("no-raw-price-format (jsx-text)", rule, {
      valid: [
        {
          name: "JSX with no `$` prefix before an expression is fine",
          filename: fileIn("client/src/components/Price.tsx"),
          code: "export const X = () => (<div>Total {(5).toFixed(2)}</div>);\n",
        },
        {
          name: "JSX with text-only `$` (no following expression) is fine",
          filename: fileIn("client/src/components/Price.tsx"),
          code: "export const X = () => (<div>$5.00</div>);\n",
        },
      ],
      invalid: [
        {
          name: "JSX text ending in `$` immediately before `{...}` is rejected",
          filename: fileIn("client/src/components/Price.tsx"),
          code: "export const X = () => (<div>${(5 / 100).toFixed(2)}</div>);\n",
          errors: [{ messageId: "jsxText" }],
        },
        {
          name: "JSX text `Price: $` before `{...}` is rejected",
          filename: fileIn("client/src/components/Price.tsx"),
          code: "const v = 5;\nexport const X = () => (<span>Price: ${v}</span>);\n",
          errors: [{ messageId: "jsxText" }],
        },
      ],
    });
  });

  describe("string-concat pattern", () => {
    tsTester.run("no-raw-price-format (string-concat)", rule, {
      valid: [
        {
          name: "concatenation with two literals is fine (no dynamic value)",
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const s = "$" + "5";\n',
        },
        {
          name: "concatenation that does not end in `$` is fine",
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const v = 5;\nconst s = "Total: " + v;\n',
        },
      ],
      invalid: [
        {
          name: '`"$" + value` is rejected',
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const v = 5;\nconst s = "$" + v;\n',
          errors: [{ messageId: "stringConcat" }],
        },
        {
          name: '`"Price: $" + value` is rejected',
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const v = 5;\nconst s = "Price: $" + v;\n',
          errors: [{ messageId: "stringConcat" }],
        },
        {
          name: "single-element template literal ending in `$` concatenated with a value is rejected",
          filename: fileIn("client/src/components/Price.ts"),
          code: "const v = 5;\nconst s = `$` + v;\n",
          errors: [{ messageId: "stringConcat" }],
        },
      ],
    });
  });

  describe("array-join pattern", () => {
    tsTester.run("no-raw-price-format (array-join)", rule, {
      valid: [
        {
          name: "array.join without a `$` element is fine",
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const v = 5;\nconst s = ["Total", v].join(" ");\n',
        },
        {
          name: ".join called on a non-array-literal receiver is not flagged",
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const arr = ["$", 5];\nconst s = arr.join("");\n',
        },
      ],
      invalid: [
        {
          name: '`["$", value].join("")` is rejected',
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const v = 5;\nconst s = ["$", v].join("");\n',
          errors: [{ messageId: "arrayJoin" }],
        },
        {
          name: '`["Price: $", value].join("")` is rejected',
          filename: fileIn("client/src/components/Price.ts"),
          code: 'const v = 5;\nconst s = ["Price: $", v].join("");\n',
          errors: [{ messageId: "arrayJoin" }],
        },
      ],
    });
  });

  describe("allowlist", () => {
    // The two helper files are the *only* place raw `$` prefix patterns are
    // allowed — they are the helpers everything else routes through. If the
    // ALLOWLIST changes silently, these cases will start failing because the
    // rule will start reporting on them.
    tsTester.run("no-raw-price-format (allowlist)", rule, {
      valid: [
        {
          name: "client/src/lib/safePrice.ts is exempt from the rule",
          filename: fileIn("client/src/lib/safePrice.ts"),
          code: "const v = 5;\nconst s = `$${v}`;\n",
        },
        {
          name: "shared/safePrice.ts is exempt from the rule",
          filename: fileIn("shared/safePrice.ts"),
          code:
            'const v = 5;\n' +
            'const a = `$${v}`;\n' +
            'const b = "$" + v;\n' +
            'const c = ["$", v].join("");\n',
        },
      ],
      invalid: [
        {
          name: "a sibling file in client/src/lib/ is NOT exempt",
          filename: fileIn("client/src/lib/notSafePrice.ts"),
          code: "const v = 5;\nconst s = `$${v}`;\n",
          errors: [{ messageId: "templateLiteral" }],
        },
        {
          name: "a sibling file in shared/ is NOT exempt",
          filename: fileIn("shared/notSafePrice.ts"),
          code: "const v = 5;\nconst s = `$${v}`;\n",
          errors: [{ messageId: "templateLiteral" }],
        },
      ],
    });
  });
});
