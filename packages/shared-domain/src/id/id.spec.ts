import { DomainError } from "../errors/domain-error.js";
import { Id, idSchema } from "./id.js";

// A valid UUIDv7 with hex letters in every group, so upper-casing the input
// actually changes it (an all-digit value would make the case tests vacuous).
const VALID_V7 = "01912f00-0001-7abc-8abc-0fedcba98765";

// Two v7 values with distinct timestamps (0x000000100001 vs 0x000000100002),
// constructed by string, no generator needed. Per RFC 9562 the 48-bit
// milliseconds timestamp sits big-endian in the first two groups, so the
// lexicographic order of the canonical strings is the timestamp order.
const EARLY_TS_V7 = "00000010-0001-7000-8000-000000000000";
const LATE_TS_V7 = "00000010-0002-7000-8000-000000000000";

// One shared table: `Id.parse` and `idSchema` must agree on every case, so a
// future divergence between the two fails here regardless of direction.
const VALIDITY_CASES: ReadonlyArray<{ name: string; input: string; valid: boolean }> = [
  { name: "a valid v7", input: VALID_V7, valid: true },
  { name: "a valid v7 uppercased", input: VALID_V7.toUpperCase(), valid: true },
  { name: "a v4", input: "ffffffff-ffff-4fff-8fff-ffffffffffff", valid: false },
  { name: "the nil UUID", input: "00000000-0000-0000-0000-000000000000", valid: false },
  { name: "a too-short string", input: "01912f00-0001-7000", valid: false },
  { name: "a non-hex character", input: "01912f00-0001-7000-8000-0000000000gg", valid: false },
  { name: "a missing group", input: "01912f00-0001-7000-8000ffffffffffff", valid: false },
  { name: "an empty string", input: "", valid: false },
];

describe("Id", () => {
  it("is a phantom brand: assignable to string, while a string is not an Id", () => {
    const id: Id = Id.parse(VALID_V7);
    const asString: string = id;
    expect(asString).toBe(VALID_V7);

    // Type-level probe: @ts-expect-error only silences the compiler, the
    // guarded expression must never run, so it lives in a closure that is
    // never called. An unused @ts-expect-error would be a TS2578 error, so a
    // green `tsc` proves this really exercises the missing brand.
    const negativeProbe = (): void => {
      const plain: string = VALID_V7;
      // @ts-expect-error a plain string is not assignable to the branded Id
      const notAnId: Id = plain;
      void notAnId;
    };
    expect(typeof negativeProbe).toBe("function");
  });

  it("normalises uppercase input to the canonical lowercase value", () => {
    expect(Id.parse(VALID_V7.toUpperCase())).toBe(VALID_V7);
  });

  it("parses the same value in different cases to identical ids", () => {
    expect(Id.parse(VALID_V7.toUpperCase())).toBe(Id.parse(VALID_V7));
  });
});

describe("Id.parse and idSchema agree on validity", () => {
  describe.each(VALIDITY_CASES)("$name", ({ input, valid }) => {
    it("reach the same verdict", () => {
      expect(idSchema.safeParse(input).success).toBe(valid);

      let threw = false;
      try {
        Id.parse(input);
      } catch {
        threw = true;
      }
      expect(threw).toBe(!valid);
    });
  });
});

describe("Id.parse rejection", () => {
  it("throws a DomainError carrying INVALID_ID and the original input", () => {
    // Uppercase and impossible hex: a naive validator that normalises before
    // validating would report the lower-cased value. The contract says the
    // params carry exactly what the caller sent.
    const original = "01912F00-0001-7000-8000-0000000000ZZ";
    expect(() => Id.parse(original)).toThrow(DomainError);

    let caught: DomainError | undefined;
    try {
      Id.parse(original);
    } catch (error) {
      caught = error as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe("INVALID_ID");
    expect(caught?.params.value).toBe(original);
    expect(caught?.message).toContain(original);
    // ADR-0007: never an HTTP status; the transport boundary maps code to
    // status.
    expect(caught).not.toHaveProperty("status");
    expect(caught).not.toHaveProperty("statusCode");
  });

  describe.each([
    { name: "variant bits 01 (group starts 4)", input: "01912f00-0001-7000-4000-000000000000" },
    { name: "variant bits 00 (group starts 0)", input: "01912f00-0001-7000-0000-000000000000" },
  ])("$name", ({ input }) => {
    it("rejects the value for its variant bits", () => {
      expect(() => Id.parse(input)).toThrow(DomainError);
    });
  });
});

describe("Id ordering and round-trip", () => {
  it("orders lexicographically by timestamp", () => {
    expect(Id.parse(EARLY_TS_V7) < Id.parse(LATE_TS_V7)).toBe(true);
    expect(Id.parse(LATE_TS_V7) > Id.parse(EARLY_TS_V7)).toBe(true);
  });

  it("survives a JSON round-trip and re-parsing is idempotent", () => {
    const id = Id.parse(VALID_V7);
    const revived = JSON.parse(JSON.stringify(id)) as string;
    expect(revived).toBe(VALID_V7);
    expect(Id.parse(revived)).toBe(id);
  });
});