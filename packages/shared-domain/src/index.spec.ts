import * as barrel from "./index.js";
import { DomainError, ERROR_MESSAGES, Id, idSchema } from "./index.js";
import type { ErrorCode, ErrorCodeMap, IdGenerator } from "./index.js";

// A valid UUIDv7 with hex letters in every group (same fixture as id.spec.ts,
// so the barrel still behaves like the value object it re-exports).
const VALID_V7 = "01912f00-0001-7abc-8abc-0fedcba98765";

describe("@tiendita/shared-domain public surface", () => {
  it("exports exactly the documented runtime values and nothing else", () => {
    // Type-only exports are erased at runtime, so the live module namespace
    // holds only the four values. Equality against a literal list — not a
    // subset check — so an accidental extra export fails this test.
    expect(Object.keys(barrel).sort()).toEqual([
      "DomainError",
      "ERROR_MESSAGES",
      "Id",
      "idSchema",
    ]);

    // The named imports are the same bindings the namespace exposes, so the
    // two import shapes can never disagree about what the barrel ships.
    expect(barrel.Id).toBe(Id);
    expect(barrel.idSchema).toBe(idSchema);
    expect(barrel.DomainError).toBe(DomainError);
    expect(barrel.ERROR_MESSAGES).toBe(ERROR_MESSAGES);
  });

  it("reaches every documented type through the barrel", () => {
    // `Id` is value and type in one: `Id.parse` returns the branded type, and
    // the annotation below proves the type meaning survived the re-export.
    const id: Id = Id.parse(VALID_V7);
    // `IdGenerator` is type-only, so the port has to be implementable through
    // the barrel. It stays synchronous and returns `Id` (ADR-0001).
    const generator: IdGenerator = {
      next: () => Id.parse(VALID_V7),
    };
    // `ErrorCode` is the code union; `ErrorCodeMap` pins the params per code.
    const code: ErrorCode = "INVALID_ID";
    const map: ErrorCodeMap = { INVALID_ID: { value: VALID_V7 } };

    expect(id).toBe(VALID_V7);
    expect(generator.next()).toBe(VALID_V7);
    expect(code).toBe("INVALID_ID");
    expect(map.INVALID_ID.value).toBe(VALID_V7);

    // Type-level probes: @ts-expect-error only silences the compiler, the
    // guarded expressions must never run, so they live in a closure that is
    // never called (id.spec.ts does the same). An unused @ts-expect-error
    // would be a TS2578 error, so a green `tsc` proves each probe really
    // exercises the boundary the barrel is supposed to export.
    const negativeProbes = (): void => {
      const plain: string = VALID_V7;
      // @ts-expect-error a plain string is not assignable to the branded Id
      const notAnId: Id = plain;
      void notAnId;

      // @ts-expect-error a generator returning a plain string does not satisfy the port
      const notAGenerator: IdGenerator = { next: () => plain };
      void notAGenerator;

      // @ts-expect-error an unknown code is not a member of the ErrorCode union
      const notACode: ErrorCode = "NOT_A_CODE";
      void notACode;

      // @ts-expect-error a code's params must keep the mapped shape ({ value: string })
      const wrongParams: ErrorCodeMap = { INVALID_ID: { value: 42 } };
      void wrongParams;
    };
    expect(typeof negativeProbes).toBe("function");
  });
});