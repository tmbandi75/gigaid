import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

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
    },
    rules: {
      "no-console": "error",
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
    },
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["server/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
