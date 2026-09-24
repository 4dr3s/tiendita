import { Id } from "./id.js";
import type { IdGenerator } from "./id-generator.js";

// An interface has no runtime behaviour of its own, so this suite proves the
// *contract* through deterministic fakes — which is exactly what strict TDD
// needs (ADR-0001): the port exists so infrastructure supplies real UUIDv7
// values while domain tests stay deterministic and I/O-free.

// UUIDv7 layout (RFC 9562), from the string outward: the first two groups
// carry the 48-bit milliseconds timestamp big-endian, group 3 starts with the
// version nibble 7, group 4 starts with the RFC variant nibble (`10xx`, so
// 8), and group 5 is a 48-bit tail. With everything but the tail fixed, the
// canonical string order of two values is exactly their tail order — the
// lexicographic keyset ADR-0005 relies on.
const FIXED_MS_V7 = "01912f00-0001";

const counterV7 = (tail: number): string =>
  `${FIXED_MS_V7}-7000-8000-${tail.toString(16).padStart(12, "0")}`;

// Deterministic fake #1 — a fixed timestamp and a rising 48-bit tail. The
// string is cast, not validated: a real adapter also produces the value and
// leaves validity to the value object, so whether the shape is accepted is
// asserted separately below, not assumed by construction.
class CounterIdGenerator implements IdGenerator {
  private tail = 0;

  next(): Id {
    const value = counterV7(this.tail);
    this.tail += 1;
    return value as Id;
  }
}

// Deterministic fake #2 — a *different* construction: the timestamp advances
// (still strictly, still v7-shaped, with a fixed tail) instead of the tail
// rising. Unrelated shape, same port, so both satisfying `IdGenerator` proves
// the port is an abstraction rather than a mould for one fake.
class ClockIdGenerator implements IdGenerator {
  // A fixed epoch: 2023-11-14T22:13:20Z, so the counter is deterministic.
  private epochMs = 1_700_000_000_000;

  next(): Id {
    const ms = this.epochMs.toString(16).padStart(12, "0");
    this.epochMs += 1000;
    const value = `${ms.slice(0, 8)}-${ms.slice(8)}-7000-8000-000000000000`;
    return value as Id;
  }
}

// "Many calls": enough to cross digits in the rising tail and to make a
// non-monotonic sequence obvious, while staying comfortably inside the 48-bit
// tail field.
const COUNTER_SAMPLES = 100;

describe("IdGenerator port", () => {
  describe("counter-backed fake", () => {
    it("produces strictly increasing values across many calls", () => {
      const generator: IdGenerator = new CounterIdGenerator();
      const values: Id[] = [];
      for (let i = 0; i < COUNTER_SAMPLES; i += 1) {
        values.push(generator.next());
      }

      for (let i = 1; i < values.length; i += 1) {
        // v7 canonical strings order lexicographically by timestamp, so
        // string `<` is exactly the keyset order ADR-0005 depends on — the
        // strict increase is proven without any generator library.
        expect(values[i - 1] < values[i]).toBe(true);
      }
    });

    it("produces values the value object accepts", () => {
      const generator: IdGenerator = new CounterIdGenerator();
      for (let i = 0; i < COUNTER_SAMPLES; i += 1) {
        const value = generator.next();
        // The fake returns the canonical string unchanged, so a successful
        // parse with identity back is the round-trip: a repository that
        // validates on entry (ADR-0001) would accept the whole sequence.
        expect(Id.parse(value)).toBe(value);
      }
    });

    it("is deterministic: two instances produce identical sequences", () => {
      const first = new CounterIdGenerator();
      const second = new CounterIdGenerator();
      for (let i = 0; i < COUNTER_SAMPLES; i += 1) {
        expect(first.next()).toBe(second.next());
      }
    });
  });

  describe("a second, structurally different generator", () => {
    it("satisfies the same port", () => {
      const generator: IdGenerator = new ClockIdGenerator();
      const values: Id[] = [];
      for (let i = 0; i < 5; i += 1) {
        values.push(generator.next());
      }

      // Advancing timestamp, so this generator is strictly increasing too.
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i - 1] < values[i]).toBe(true);
      }
      // And its shapes pass the same entry validation.
      for (const value of values) {
        expect(Id.parse(value)).toBe(value);
      }
    });

    it("produces a sequence the counter fake never emits", () => {
      // The two constructions share no first value, so the port is provably
      // not shaped around one generator: each identifier here is shaped by
      // its own implementation, not by the port.
      const counter: IdGenerator = new CounterIdGenerator();
      const clock: IdGenerator = new ClockIdGenerator();
      expect(clock.next()).not.toBe(counter.next());
    });
  });

  it("rejects an implementation that returns a plain string", () => {
    // Type-level probe: @ts-expect-error only silences the compiler, the
    // guarded expression must never run, so it lives in a closure that is
    // never called (id.spec.ts does the same). An unused @ts-expect-error
    // would be a TS2578 error, so a green `tsc` proves this really exercises
    // the missing brand at the port boundary.
    const negativeProbe = (): void => {
      class StringGenerator {
        next(): string {
          return "01912f00-0001-7000-8000-000000000000";
        }
      }
      // @ts-expect-error an implementation returning a plain string does not
      // satisfy the port: the brand dies here, and every consumer would be
      // back to raw strings (ADR-0001's shared contract).
      const generator: IdGenerator = new StringGenerator();
      void generator;
    };
    expect(typeof negativeProbe).toBe("function");
  });
});