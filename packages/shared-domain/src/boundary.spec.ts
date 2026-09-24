// ADR-0007 boundary enforcement for @tiendita/shared-domain (K3).
//
// The hexagonal rule forbids `@nestjs/*` in domain and application, and
// ADR-0007 requires that denial to be *asserted by a test* rather than
// agreed by convention. K3 extends the denial to `@prisma/client`,
// `better-auth` and `express`, each denied as a whole package including
// its subpaths (`@prisma/client/runtime/library` is just as banned as the
// bare package: that subpath is how Prisma is actually imported). This
// spec walks the package's own sources and enforces that boundary
// directly, with an intentional tripwire on any other external dependency
// (see the last test).
//
// Non-vacuity: a walk that silently matches zero files would repeat the
// turbo zero-task green of K1 in a new place, so the discovery itself is
// asserted (file count, known files) before any denial rule is judged.
//
// What the extractor can decide, and what it cannot. Every file is parsed
// with the TypeScript compiler API, and these static spellings of a module
// binding are read off the resulting AST: static `import` / `import type`,
// `export ... from`, `import x = require("...")`, dynamic `import("...")`,
// bare `require("...")`, and their single-quoted-or-backticked literal
// arguments (`import(`express`)`, `require(`better-auth`)`). Type queries
// (`import("better-auth").SomeType`, `typeof import("express")`) are also
// read off the AST, and triple-slash `/// <reference types="express" />`
// directives are scanned line by line because they are not AST nodes at
// all. The guarantee has a boundary no static scanner can cross: a
// specifier computed at runtime — `import(name)`, `require(path)` — is not
// a literal and is deliberately not recorded, because the text being
// imported is unknown until execution. This covers every spelling that can
// be judged by reading the source; it cannot predict what a runtime
// expression will resolve to, and it does not claim to.
//
// A hand-rolled lexer cannot be made sound — the character-state scanner
// that predates this version mislexed an ordinary division after an
// object literal (`const ratio = { n: 1 } / 2;`) as the start of a regex
// literal, then swallowed all text until the next `/`, hiding a genuine
// denied import that sat on the very next line. The compiler's own lexer
// and parser have no such regex-vs-division fork, so that entire class of
// false negative is gone; the exact probe is pinned below as a permanent
// regression test.
//
// The B10 tripwire deliberately scans *shipped* sources only — anything
// but `*.spec.ts`. B10 decided that every runtime dependency of this
// contract package is a permanent commitment a future mobile client
// inherits, and tsconfig.build.json excludes `*.spec.ts` from the build:
// specs are not part of the shipped contract and may legitimately import
// devDependencies, which is exactly what this enforcement machinery
// itself now does by importing `typescript`. The ADR-0007 denial test
// still runs over every walked file, specs included — a denied import
// anywhere in the package is a violation no matter who ships it.

import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

// Jest 30 does not accept a custom message on `expect(value, message)`, so
// the assertions below use a throwing guard: a failed invariant surfaces as
// a failed test whose message carries the full evidence.
function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Resolved from this file's own location — never from process.cwd() or a
// hardcoded absolute path — so the walk is correct no matter where the
// suite is invoked from.
const SRC_DIR = new URL(".", import.meta.url);

// K3's wording, expanded from exact names to package-plus-subpaths:
// `@nestjs/*` is denied as a prefix, and each of `@prisma/client`,
// `better-auth` and `express` is denied both exactly and with any subpath
// appended. A denial that recognised only the bare spelling would be
// decorative — `better-auth/react` is how that package is imported in
// practice.
const DENIED_RULES: ReadonlyArray<{
  test: (specifier: string) => boolean;
  reason: string;
}> = [
  {
    test: (s) => s.startsWith("@nestjs/"),
    reason: "ADR-0007 denies @nestjs/*",
  },
  {
    test: (s) => s === "@prisma/client" || s.startsWith("@prisma/client/"),
    reason: "K3 denies @prisma/client and its subpaths",
  },
  {
    test: (s) => s === "better-auth" || s.startsWith("better-auth/"),
    reason: "K3 denies better-auth and its subpaths",
  },
  {
    test: (s) => s === "express" || s.startsWith("express/"),
    reason: "K3 denies express and its subpaths",
  },
];

interface LocatedImport {
  line: number;
  specifier: string;
}

// Default-import form: `import ts from "typescript"` compiles under this
// package's tsconfig (esModuleInterop is set) and resolves at runtime under
// ts-jest's ESM loader, where Node's CJS interop binds the default export to
// the package's `module.exports`.
function findImports(source: string): LocatedImport[] {
  const sourceFile = ts.createSourceFile(
    "__boundary_synthetic__.ts",
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const found: LocatedImport[] = [];

  // Records a module specifier with the 1-based line of the statement that
  // binds it, so failures read `relative/path.ts:line: specifier`.
  const record = (node: ts.Node, moduleSpecifier: ts.Expression): void => {
    // A quoted string literal or a substitution-free template literal
    // (`import(`express`)`) binds a module by name; both expose `.text`.
    // `import(name)` or `require(name)` with a computed argument binds
    // nothing here: the specifier is unknown until runtime.
    if (
      !ts.isStringLiteral(moduleSpecifier) &&
      !ts.isNoSubstitutionTemplateLiteral(moduleSpecifier)
    ) {
      return;
    }
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    found.push({ line: line + 1, specifier: moduleSpecifier.text });
  };

  // Every construct that binds a module by specifier — and nothing else: a
  // bare string is just a value, and `obj.require(...)` / `obj.from(...)`
  // are property accesses, not module calls.
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      // `import x from "..."` and bare `import "..."` (also `import type`).
      record(node, node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      // `export ... from "..."` (also `export * from` / `export type ... from`).
      const { moduleSpecifier } = node;
      if (moduleSpecifier !== undefined) record(node, moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node)) {
      // `import x = require("...")` binds an external module by specifier;
      // the qualified-name form (`import x = A.B`) binds nothing external.
      if (ts.isExternalModuleReference(node.moduleReference)) {
        record(node, node.moduleReference.expression);
      }
    } else if (ts.isImportTypeNode(node)) {
      // Type query: `import("better-auth").SomeType` and
      // `typeof import("express")`. A type query is not a CallExpression,
      // so the dynamic-import branch below never sees it — yet it couples
      // the package to the named module exactly as an import does. The
      // argument is a type node wrapping the literal; anything but a string
      // literal (there is no legal runtime-computed spelling here) binds
      // nothing.
      const { argument } = node;
      if (
        ts.isLiteralTypeNode(argument) &&
        ts.isStringLiteral(argument.literal)
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        found.push({ line: line + 1, specifier: argument.literal.text });
      }
    } else if (ts.isCallExpression(node)) {
      // Dynamic `import("...")` and bare `require("...")`.
      const { expression: callee } = node;
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const isBareRequire =
        ts.isIdentifier(callee) && callee.text === "require";
      if ((isDynamicImport || isBareRequire) && node.arguments.length > 0) {
        record(node, node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  // Triple-slash reference directives are not AST nodes — the parser drops
  // them — so no AST walk can see them: scan each source line instead. Only
  // `types="..."` names a package. `path="..."` is a relative path and
  // `lib="..."` is a TypeScript lib, neither of which is a module
  // specifier, so this pattern intentionally matches neither; they are left
  // unmatched rather than folded into a rule that would deny something that
  // is not a dependency. The reported line is the directive's own line.
  const referenceTypes =
    /^\s*\/\/\/\s*<reference\s+types\s*=\s*(["'])([^"']+)\1\s*\/>/;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = referenceTypes.exec(line);
    if (match !== null) {
      found.push({ line: index + 1, specifier: match[2] });
    }
  }

  return found;
}

// `readdirSync` with `recursive: true` also lists directory entries and,
// on Windows, uses backslashes; filter to `.ts` files and normalize so the
// assertions below are platform-independent.
function discoverSources(): string[] {
  const entries = readdirSync(SRC_DIR, { encoding: "utf8", recursive: true });
  return entries
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((entry) => entry.endsWith(".ts"))
    .sort();
}

describe("ADR-0007 boundary (framework-free import policy)", () => {
  const files = discoverSources();

  // Suite-level read: loads every discovered source once, up front, so
  // each test below is I/O-free and the walk cost is paid a single time.
  const sources = new Map(
    files.map((file) => [file, readFileSync(new URL(file, SRC_DIR), "utf8")]),
  );

  it("discovers a real source tree, not an empty one (K1 non-vacuity guard)", () => {
    ensure(
      files.length >= 10,
      `expected at least 10 source files under src/, found ${files.length}: ${files.join(", ")}`,
    );
  });

  it("discovers the files the package must contain", () => {
    const required = ["errors/codes.ts", "id/id.ts", "index.ts"];
    const missing = required.filter((file) => !files.includes(file));
    ensure(
      missing.length === 0,
      `walk did not discover required sources (${missing.join(", ")}); found ${files.length} files: ${files.join(", ")}`,
    );
  });

  it("imports no module the ADR denies (relative/path.ts:line: specifier)", () => {
    // Every violation is reported, not just the first: one actionable
    // failure beats a hunt through the tree. Specs included: a denied
    // import anywhere in the package is a violation.
    const violations: string[] = [];
    for (const file of files) {
      const source = sources.get(file);
      if (source === undefined) continue;
      for (const { line, specifier } of findImports(source)) {
        for (const rule of DENIED_RULES) {
          if (rule.test(specifier)) {
            violations.push(`${file}:${line}: ${specifier}`);
          }
        }
      }
    }
    ensure(
      violations.length === 0,
      `ADR-0007 denied imports found:\n${violations.join("\n")}`,
    );
  });

  it("adds no external dependency beyond zod (B10 tripwire)", () => {
    // Deliberate addition beyond K3: a denylist only forbids the four
    // frameworks somebody already thought of, while B10 decided that every
    // dependency of this contract package is a permanent commitment a
    // future mobile client inherits. The whitelist makes the next external
    // dependency a conscious decision that must edit this test.
    //
    // Scoped to shipped sources (everything but `*.spec.ts`): B10's
    // commitment runs only to the code a future mobile client actually
    // receives, and tsconfig.build.json excludes specs from the build —
    // test files may legitimately use devDependencies, exactly as this
    // spec itself does by importing `typescript`. The ADR-0007 denial
    // test above still scans every walked file, spec or not.
    const external = new Set<string>();
    for (const file of files) {
      if (file.endsWith(".spec.ts")) continue;
      const source = sources.get(file);
      if (source === undefined) continue;
      // Relative imports ("./") are internal; "node:" builtins are not
      // dependencies. Everything else is an external package import.
      for (const { specifier } of findImports(source)) {
        if (!specifier.startsWith(".") && !specifier.startsWith("node:")) {
          external.add(specifier);
        }
      }
    }
    const actual = [...external].sort();
    ensure(
      actual.length === 1 && actual[0] === "zod",
      [
        "The external dependency set left the blessed zod-only state.",
        "",
        "This assertion is a tripwire over the shipped sources — everything",
        "but `*.spec.ts`, because tsconfig.build.json excludes specs from",
        "the build, so specs may legitimately import devDependencies (this",
        "spec itself does, with `typescript`). B10 decided every dependency",
        "of this contract package is a permanent commitment a future mobile",
        "client inherits, so a denylist alone is not enough. Adding an",
        "external dependency is a deliberate decision that must update this",
        "assertion together with package.json dependencies and the README's",
        "dependency note. Deleting this assertion to silence it is the wrong",
        "fix.",
      ].join("\n"),
    );
  });

  // The enforcement machinery is tested against synthetic source strings —
  // never the filesystem — so a future change to the extractor cannot rot
  // the denials silently. This is the durable replacement for the
  // one-shot probe that first proved (and then stopped proving) the rule.
  describe("import extraction self-tests (synthetic source, never the filesystem)", () => {
    it("recognises every real import shape with a denied specifier", () => {
      const shapes: ReadonlyArray<string> = [
        'import x from "better-auth";',
        'export { x } from "better-auth";',
        'import "better-auth";',
        'import("better-auth");',
        'require("better-auth");',
      ];
      for (const source of shapes) {
        const specifiers = findImports(source).map((f) => f.specifier);
        expect(specifiers).toEqual(["better-auth"]);
      }
    });

    it("denies each banned package in its main and subpath forms", () => {
      const cases: ReadonlyArray<readonly [string, boolean]> = [
        ["@nestjs/core", true],
        ["@prisma/client", true],
        ["@prisma/client/runtime/library", true],
        ["better-auth", true],
        ["better-auth/react", true],
        ["express", true],
        ["express/lib/router", true],
        ["zod", false],
        ["node:fs", false],
        ["./id/id.js", false],
      ];
      for (const [specifier, denied] of cases) {
        const hit = DENIED_RULES.some((rule) => rule.test(specifier));
        expect(hit).toBe(denied);
      }
    });

    it("flags subpath specifiers through the extractor and reports the line", () => {
      const source = [
        'import "better-auth/react";',
        'import "@prisma/client/runtime/library";',
        'import "@nestjs/core";',
        'import "express/lib/router";',
      ].join("\n");
      const found = findImports(source).map((f) => `${f.line}:${f.specifier}`);
      expect(found).toEqual([
        "1:better-auth/react",
        "2:@prisma/client/runtime/library",
        "3:@nestjs/core",
        "4:express/lib/router",
      ]);
    });

    it("ignores denied-looking fragments in comments, strings, templates and regexes", () => {
      const source = [
        '// Historical note: this package once did `import "express"` here.',
        '/* import "express" — dead code, quoted for posterity */',
        "const note = 'import \"better-auth\" — just prose';",
        'const other = "requires \\"@prisma/client\\"";',
        'const tpl = `import "express" here`;',
        'const re = /from "express"/;',
      ].join("\n");
      expect(findImports(source)).toEqual([]);
    });

    it("still scans code inside template expressions", () => {
      const source = 'const p = `path ${import("better-auth")}`;';
      const specifiers = findImports(source).map((f) => f.specifier);
      expect(specifiers).toEqual(["better-auth"]);
    });

    it("flags template-literal module arguments (import(`x`) and require(`x`))", () => {
      // The verifier's probe A: `import(`express`)` is an executable
      // runtime import, not a type-space nicety, and `ts.isStringLiteral`
      // alone missed it. `NoSubstitutionTemplateLiteral` also exposes
      // `.text`, so it is recorded with the call's line.
      const source = [
        "export async function load() {",
        "  return import(`express`);",
        "}",
        "const loaded = require(`better-auth`);",
      ].join("\n");
      const found = findImports(source).map((f) => `${f.line}:${f.specifier}`);
      expect(found).toEqual(["2:express", "4:better-auth"]);
    });

    it("does not record a computed module argument (documented extractor limit)", () => {
      // A specifier computed at runtime is the boundary of any static
      // scanner. This is asserted, not accidentally observed, so the limit
      // cannot regress into silent acceptance of arbitrary expressions.
      const source = [
        'const name = "express";',
        "const mod = await import(name);",
        "const other = require(name);",
      ].join("\n");
      expect(findImports(source)).toEqual([]);
    });

    it('flags type-query imports (import("x").T and typeof import("x"))', () => {
      // The verifier's probe B: an `ImportTypeNode` is a type query, not a
      // CallExpression, so the walk never recorded it — even though
      // `import type X from "better-auth"` was caught. Both spellings are
      // now flagged with the node's line.
      const source = [
        'export type Auth = import("better-auth").SomeType;',
        'export type Express = typeof import("express");',
      ].join("\n");
      const found = findImports(source).map((f) => `${f.line}:${f.specifier}`);
      expect(found).toEqual(["1:better-auth", "2:express"]);
    });

    it("flags triple-slash reference types directives (single quotes and spacing)", () => {
      // The verifier's probe C: a directive is not an AST node, so it needs
      // an explicit line scan. The reported line is the directive's own.
      const source = [
        '/// <reference types="express" />',
        "export const x = 1;",
        "///   <reference   types='better-auth'/>",
      ].join("\n");
      const found = findImports(source).map((f) => `${f.line}:${f.specifier}`);
      expect(found).toEqual(["1:express", "3:better-auth"]);
    });

    it("ignores reference path and lib directives (neither is a module specifier)", () => {
      // `path="..."` is a relative path and `lib="..."` is a TypeScript
      // lib; neither names a package, so neither is denied.
      const source = [
        '/// <reference path="./probe.d.ts" />',
        '/// <reference lib="dom" />',
      ].join("\n");
      expect(findImports(source)).toEqual([]);
    });

    it("flags a denied import after a division the old lexer misread as a regex", () => {
      // The exact probe that sank the character-state scanner: `}` before
      // `/` was lexed as "could start a regex", so everything up to the
      // next `/` (inside `better-auth/react`) was swallowed as regex
      // content and the denied import vanished. The compiler API parses
      // this as an ordinary division and an ordinary ImportDeclaration.
      const source = [
        "const ratio = { n: 1 } / 2;",
        'import "better-auth/react";',
        "export const ok = Number.isNaN(ratio);",
      ].join("\n");
      const found = findImports(source).map((f) => `${f.line}:${f.specifier}`);
      expect(found).toEqual(["2:better-auth/react"]);
    });

    it("does not flag allowed specifiers as denied", () => {
      const source = [
        'import { z } from "zod";',
        'import { readFileSync } from "node:fs";',
        'import { id } from "./id/id.js";',
      ].join("\n");
      const found = findImports(source).map((f) => f.specifier);
      expect(found).toEqual(["zod", "node:fs", "./id/id.js"]);
      expect(
        found.every((specifier) =>
          DENIED_RULES.every((rule) => !rule.test(specifier)),
        ),
      ).toBe(true);
    });
  });
});
