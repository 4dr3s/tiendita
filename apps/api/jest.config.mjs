// Jest runs the API suite as ECMAScript modules, because the API itself is ESM
// (`"type": "module"`) and its runtime dependencies are ESM.
//
// This file is .mjs on purpose: with `"type": "module"`, a TypeScript config file would
// need its own loader, and a plain ESM config removes that question entirely.
export default {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        useESM: true,
      },
    ],
  },
  // TypeScript requires explicit .js extensions on relative ESM imports while the
  // sources are .ts, so the runner maps the specifier back before resolving.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};