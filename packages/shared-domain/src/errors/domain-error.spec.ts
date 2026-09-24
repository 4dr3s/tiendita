import { DomainError } from "./domain-error.js";

describe("DomainError", () => {
  it("carries a stable machine-readable code and its params", () => {
    const err = new DomainError("INVALID_ID", { value: "abc-123" });
    expect(err.code).toBe("INVALID_ID");
    expect(err.params).toEqual({ value: "abc-123" });
  });

  it("is an Error with a stable name", () => {
    const err = new DomainError("INVALID_ID", { value: "abc" });
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DomainError");
    expect(new DomainError("INVALID_ID", { value: "def" }).name).toBe(
      "DomainError",
    );
  });

  it("never carries an HTTP status", () => {
    const err = new DomainError("INVALID_ID", { value: "abc" });
    expect(err).not.toHaveProperty("status");
    expect(err).not.toHaveProperty("statusCode");
  });

  it("uses the default message from the error table when none is given", () => {
    const err = new DomainError("INVALID_ID", { value: "abc" });
    expect(err.message).toBe("Invalid ID: abc");
  });

  it("prefers an explicit message over the default", () => {
    const err = new DomainError("INVALID_ID", { value: "abc" }, "custom copy");
    expect(err.message).toBe("custom copy");
  });

  // Type-level probes below: @ts-expect-error only silences the compiler, the
  // guarded expressions must never run, so they live in closures that are
  // never called.
  it("enforces per-code params at construction time", () => {
    const invalidConstructions = (): void => {
      // @ts-expect-error INVALID_ID requires a { value: string } param
      new DomainError("INVALID_ID");
      // @ts-expect-error INVALID_ID requires value: string, not number
      new DomainError("INVALID_ID", { value: 42 });
      // @ts-expect-error UNKNOWN is not a code in ErrorCodeMap
      new DomainError("UNKNOWN", { value: "x" });
      // @ts-expect-error params must not contain extra keys
      new DomainError("INVALID_ID", { value: "x", extra: true });
    };
    expect(typeof invalidConstructions).toBe("function");

    const ok = new DomainError("INVALID_ID", { value: "abc" });
    // Reading back keeps the concrete param type after the literal code.
    const value: string = ok.params.value;
    expect(value).toBe("abc");
  });

  it("keeps code and params readonly", () => {
    const err = new DomainError("INVALID_ID", { value: "abc" });
    const mutationProbe = (): void => {
      // @ts-expect-error code is readonly
      err.code = "OTHER";
      // @ts-expect-error params is readonly
      err.params = { value: "zzz" };
    };
    expect(typeof mutationProbe).toBe("function");
    expect(err.code).toBe("INVALID_ID");
    expect(err.params).toEqual({ value: "abc" });
  });
});