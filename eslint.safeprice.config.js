import tsParser from "@typescript-eslint/parser";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const noRawPriceFormat = require("./eslint-rules/no-raw-price-format.cjs");

const safePricePlugin = {
  rules: { "no-raw-price-format": noRawPriceFormat },
};

const baseLanguageOptions = {
  parser: tsParser,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.d.ts",
      "android/**",
      "ios/**",
    ],
  },
  {
    files: [
      "client/src/**/*.{ts,tsx}",
      "server/**/*.{ts,tsx}",
      "shared/**/*.{ts,tsx}",
      // PDF / CSV / printable-document builders (Task #183). Today these
      // directories only hold generated JSON / PNG artifacts, but listing
      // them here means any TS / TSX builder later added (an invoice PDF
      // generator, an accountant CSV exporter, etc.) is gated by the same
      // safe-price rule the rest of the codebase already enforces.
      "reports/**/*.{ts,tsx}",
      "exports/**/*.{ts,tsx}",
      // Test fixtures and Playwright e2e specs (Task #178). Catches raw
      // `$` formatting that would otherwise hide in fixture/seed data
      // and silently get copy-pasted into product code.
      "tests/**/*.{ts,tsx}",
      "e2e/**/*.{ts,tsx}",
    ],
    languageOptions: baseLanguageOptions,
    plugins: { "safe-price": safePricePlugin },
    rules: { "safe-price/no-raw-price-format": "error" },
  },
];
