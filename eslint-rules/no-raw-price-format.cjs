"use strict";

const path = require("path");

const ALLOWLIST = new Set([
  "client/src/lib/safePrice.ts",
  "shared/safePrice.ts",
  // Test fixture file: emits human-readable plan price labels
  // (e.g. "Pro plan price is $19/mo") for the monetization test report.
  // The values come from PLAN_PRICES_CENTS, never user input, and are
  // not rendered to end users — they're console/JSON test output only.
  "tests/monetization/stripe-tests.ts",
]);

const HELPER_HINT =
  "Use safePrice / safePriceCents / safePriceCentsExact / safePriceExact / " +
  "safePriceCentsLocale / safePriceLocale / safePriceRange / formatCurrency " +
  "from @shared/safePrice (or @/lib/safePrice on the client) instead.";

function endsWithDollar(value) {
  return /\$\s*$/.test(value);
}

function isStringLiteralEndingInDollar(node) {
  if (!node) return false;
  if (node.type === "Literal" && typeof node.value === "string") {
    return endsWithDollar(node.value);
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    const only = node.quasis[0];
    return endsWithDollar(only.value.cooked != null ? only.value.cooked : only.value.raw);
  }
  return false;
}

// Recursively determine whether the *rightmost* leaf of a `+` concat tree
// is a string literal ending in `$`. This catches inner-concat variants
// like `(prefix + "$") + value`, where the immediate left-hand side of
// the outer `+` is itself a BinaryExpression that produces a string
// terminating in `$`. Without this, the outer `+` slips past the rule
// even though it would emit `prefix$<value>` at runtime.
function concatExpressionEndsInDollar(node) {
  if (!node) return false;
  if (isStringLiteralEndingInDollar(node)) return true;
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return concatExpressionEndsInDollar(node.right);
  }
  return false;
}

function toRelativeFromCwd(filename) {
  if (!filename || filename === "<input>" || filename === "<text>") return "";
  const rel = path.relative(process.cwd(), filename);
  return rel.split(path.sep).join("/");
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw '$' prefix patterns in front of dynamic values; route prices through the safePrice helpers.",
    },
    schema: [],
    messages: {
      templateLiteral:
        "Raw '$' prefix in template literal before an interpolation. " + HELPER_HINT,
      jsxText:
        "Raw '$' prefix in JSX text immediately before an expression. " + HELPER_HINT,
      stringConcat:
        "Raw '$' prefix string concatenated with a dynamic value. " + HELPER_HINT,
      arrayJoin:
        "Raw '$' prefix string used in array join() with a dynamic value. " + HELPER_HINT,
    },
  },

  create(context) {
    const filename =
      typeof context.getFilename === "function"
        ? context.getFilename()
        : context.filename;
    const rel = toRelativeFromCwd(filename);
    if (rel && ALLOWLIST.has(rel)) {
      return {};
    }

    return {
      TemplateLiteral(node) {
        for (let i = 0; i < node.quasis.length - 1; i++) {
          const q = node.quasis[i];
          if (endsWithDollar(q.value.raw)) {
            context.report({ node: q, messageId: "templateLiteral" });
          }
        }
      },

      "JSXElement, JSXFragment"(node) {
        const children = node.children || [];
        for (let i = 0; i < children.length - 1; i++) {
          const child = children[i];
          const next = children[i + 1];
          if (
            child.type === "JSXText" &&
            next.type === "JSXExpressionContainer" &&
            endsWithDollar(child.value)
          ) {
            context.report({ node: child, messageId: "jsxText" });
          }
        }
      },

      BinaryExpression(node) {
        if (node.operator !== "+") return;
        if (
          concatExpressionEndsInDollar(node.left) &&
          node.right &&
          node.right.type !== "Literal"
        ) {
          context.report({ node, messageId: "stringConcat" });
        }
      },

      CallExpression(node) {
        const callee = node.callee;
        if (
          !callee ||
          callee.type !== "MemberExpression" ||
          !callee.property ||
          callee.property.type !== "Identifier" ||
          callee.property.name !== "join" ||
          !callee.object ||
          callee.object.type !== "ArrayExpression"
        ) {
          return;
        }
        const elements = callee.object.elements || [];
        for (const el of elements) {
          if (!el) continue;
          if (el.type === "SpreadElement") continue;
          if (isStringLiteralEndingInDollar(el)) {
            context.report({ node, messageId: "arrayJoin" });
            break;
          }
        }
      },
    };
  },
};
