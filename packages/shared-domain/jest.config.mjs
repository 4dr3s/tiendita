// Jest runs the shared-domain suite as ECMAScript modules, because the package
// is ESM (`"type": "module"`) and its runtime dependencies are ESM.
//
// This file is .mjs on purpose: with `"type": "module"`, a TypeScript config
// file would need its own loader, and a plain ESM config removes that question
// entirely.
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
  // TypeScript requires explicit .js extensions on relative ESM imports while
  // the sources are .ts, so the runner maps the specifier back before resolving.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  // Coverage stays inside the package: unlike apps/api (which writes to the
  // repo-root ../coverage), each workspace owns its own artifacts here, and the
  // root .gitignore already ignores any `coverage/` directory at any depth.
  coverageDirectory: "./coverage",
  testEnvironment: "node",
};