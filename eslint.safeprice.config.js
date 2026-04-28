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
    files: ["client/src/**/*.{ts,tsx}", "server/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    languageOptions: baseLanguageOptions,
    plugins: { "safe-price": safePricePlugin },
    rules: { "safe-price/no-raw-price-format": "error" },
  },
];
