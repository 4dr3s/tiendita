import type { Id } from "./id.js";

/**
 * `IdGenerator` port (ADR-0001): the domain's only dependency for minting
 * identifiers. It is an interface on purpose — there is no domain
 * implementation; infrastructure supplies the real UUIDv7 generator, which
 * must be a vetted implementation (clock skew and same-millisecond
 * monotonicity are its responsibility, ADR-0001) and is never seen by domain
 * code.
 *
 * It must stay synchronous, for the ADR's own reasons: ADR-0001 injects the
 * same generator into Better Auth via `advanced.database.generateId`, which
 * invokes it synchronously; and the identifier must exist at
 * aggregate-construction time, before persistence, so an async `next()`
 * would infect every aggregate factory with `await` for a value that
 * involves no I/O.
 *
 * It returns `Id`, never `string`: a `string`-returning port would end the
 * brand here, and every consumer would be back to raw strings instead of the
 * shared typed contract (ADR-0001). The package's only runtime dependency is
 * `zod`, and the port must not touch it — hence the type-only import.
 */
export interface IdGenerator {
  next(): Id;
}