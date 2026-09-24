import { z } from "zod";

import { DomainError } from "../errors/domain-error.js";

/**
 * Compile-time phantom brand — never an object wrapper. `Id` is still a plain
 * `string` at runtime, so `===`, JSON round-trip, and the later Prisma
 * conversion (string ↔ `uuid` column, ADR-0001) all keep working, which a
 * class or wrapper would break.
 */
declare const idBrand: unique symbol;
export type Id = string & { readonly [idBrand]: true };

/**
 * The one source of truth for "is this a valid id": `Id.parse` is implemented
 * in terms of this schema, so the two can never disagree. The schema answers
 * validity and produces the canonical shape — uppercase is accepted and
 * normalised to lowercase rather than rejected, because equality is `===` and
 * ordering is lexicographic, so the stored value must be canonical or two
 * equal identifiers could differ (upholds ADR-0001's keyset ordering). This
 * is the only place a runtime dependency reaches in this package, and it
 * stays a plain string validator (ADR-0007: `fieldErrors` remain in the DTO
 * layer, never here).
 *
 * The v7 shape comes from zod 4's built-in `z.uuidv7()` (verified against the
 * installed 4.6.5): its regex pins the version nibble to 7, the variant bits
 * to RFC-compliant `10xx`, and the exact 8-4-4-4-12 hex grouping, and accepts
 * either case. Only the canonical-lowercase normalisation is added here.
 */
export const idSchema = z.uuidv7().transform((value) => value.toLowerCase());

/**
 * `Id` value object: a phantom-branded string with a single entry point.
 * `Id.parse` never rejects for case (it normalises), and every rejection
 * throws a DomainError carrying the original input as received, so the
 * message shows exactly what the caller sent (ADR-0007: never an HTTP
 * status).
 */
// The `type Id` above and the `const Id` below merge because a type alias
// and a value live in different declaration spaces (type vs value) — no
// namespace is needed for `Id.parse` to hang off the branded type.
export const Id = {
  parse(value: string): Id {
    const result = idSchema.safeParse(value);
    if (!result.success) {
      throw new DomainError("INVALID_ID", { value });
    }
    return result.data as Id;
  },
};