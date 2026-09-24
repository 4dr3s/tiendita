import { ERROR_MESSAGES, type ErrorCode, type ErrorCodeMap } from "./codes.js";

// The kernel's own codes. Adding a code to ErrorCodeMap without adding it here
// fails typecheck (`Record<ErrorCode, true>` requires every key), so the
// runtime coverage loop below cannot silently drift from the map.
const KERNEL_CODES: Record<ErrorCode, true> = {
  INVALID_ID: true,
};

// ADR-0007: an error added without a mapping must not degrade silently. This
// type-level assertion is the registry's own test: if a code is added to
// ErrorCodeMap without a message function here, the conditional resolves to
// `never` and the assignment stops the build.
const _messageTableCoversEveryCode: typeof ERROR_MESSAGES extends {
  [C in ErrorCode]: (params: ErrorCodeMap[C]) => string;
}
  ? true
  : never = true;

describe("ERROR_MESSAGES", () => {
  it("provides a default message function for every code", () => {
    for (const code of Object.keys(KERNEL_CODES) as ErrorCode[]) {
      const messageFn = ERROR_MESSAGES[code];
      expect(typeof messageFn).toBe("function");
      expect(typeof messageFn({} as ErrorCodeMap[typeof code])).toBe("string");
    }
    // The compile-time invariant above is read here so the assertion can
    // never silently drop out of the check.
    expect(_messageTableCoversEveryCode).toBe(true);
  });

  it("produces the default human text for INVALID_ID", () => {
    expect(ERROR_MESSAGES.INVALID_ID({ value: "abc-123" })).toBe(
      "Invalid ID: abc-123",
    );
  });
});

// ---------------------------------------------------------------------------
// Design finding: ErrorCodeMap extension by declaration merging — probe
// executed in this package and removed afterwards to keep the build green.
//
// Probe: `declare module "./codes.js" { interface ErrorCodeMap {
//   ORGANIZATION_NOT_ACTIVE: { organizationId: string }; } }` in this spec,
// then constructing DomainError<"ORGANIZATION_NOT_ACTIVE"> with an explicit
// message and discriminating on `code`.
//
// Observed result — the merging itself works in this setup (nodenext + ESM):
// the merged code compiles, constructs, carries its params, and narrows on
// `code` as a discriminated union. It also passed at runtime. But declaration
// merging is program-wide, and the kernel's closed registry is exhaustive
// over the live key set, so the augmentation breaks it in the same
// compilation:
//   codes.ts(28,14):      ERROR_MESSAGES missing ORGANIZATION_NOT_ACTIVE
//   codes.spec.ts(7,7):   KERNEL_CODES Record<ErrorCode, true> missing key
//   codes.spec.ts(26,31): union cast becomes an intersection
// This is inherent: a fixed literal cannot be exhaustive over a key set that
// another file can extend. Each aggregate that merges codes in must therefore
// bring its own message table and keep its own exhaustiveness test — the
// "mapping table needs its own test" cost from ADR-0007 applies per registry,
// not once — and the explicit `message` argument is the message seam for
// extensions until such a per-module registry exists.
// ---------------------------------------------------------------------------