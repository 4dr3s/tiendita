import { readFileSync } from "node:fs";

describe("package contract", () => {
  it("declares itself as an ECMAScript module", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { type?: string };

    expect(pkg.type).toBe("module");
  });

  it("declares an exports map with the typed package entry point", () => {
    // The shape is read from package.json, never from dist/: tests must pass
    // without a prior build, and a test that depends on emitted files is a
    // flaky test.
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { exports?: { "."?: { types?: string; default?: string } } };

    expect(pkg.exports?.["."]?.types).toBe("./dist/index.d.ts");
    expect(pkg.exports?.["."]?.default).toBe("./dist/index.js");
  });
});