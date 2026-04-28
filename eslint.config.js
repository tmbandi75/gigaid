import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const noRawPriceFormat = require("./eslint-rules/no-raw-price-format.cjs");

const safePricePlugin = {
  rules: { "no-raw-price-format": noRawPriceFormat },
};

export default [
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "safe-price": safePricePlugin,
    },
    rules: {
      "no-console": "error",
      "safe-price/no-raw-price-format": "error",
    },
  },
  {
    files: ["client/src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["client/src/components/booking/AddressAutocomplete.tsx"],
    rules: {
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "safe-price": safePricePlugin,
    },
    rules: {
      "no-console": "error",
      "safe-price/no-raw-price-format": "error",
    },
  },
  {
    files: ["server/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["shared/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "safe-price": safePricePlugin,
    },
    rules: {
      "safe-price/no-raw-price-format": "error",
    },
  },
];
