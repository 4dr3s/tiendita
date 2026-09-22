import { base } from "@tiendita/eslint-config";

// Nest-friendly tuning on top of the shared base: Nest relies on decorator
// metadata and parameter properties, and idiomatic Nest code occasionally
// uses non-null assertions in controllers/guards. Keep the relaxations
// minimal — the base typescript-eslint recommended rules still apply.
export default [
  ...base,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];