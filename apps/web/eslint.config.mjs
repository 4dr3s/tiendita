import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { base } from "@tiendita/eslint-config";

const eslintConfig = defineConfig([
  // Shared TIENDITA base first, then Next's own configs — Next's TS rules win
  // for TS/TSX files and the base only fills the gaps (no fighting).
  ...base,
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;