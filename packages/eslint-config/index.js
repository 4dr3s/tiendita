/**
 * Shared ESLint 9 flat config for TIENDITA v2 workspaces.
 *
 * `base` is the pragmatic default: JS recommended + typescript-eslint
 * recommended plus a few relaxations so scaffolding and idiomatic framework
 * code stay green. Apps compose it with their own config (Next.js apps add
 * eslint-config-next on top).
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export const base = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.cache/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Pragmatic skeleton defaults: keep type safety where it matters and
      // avoid churn on generated or scaffolded code.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default base;