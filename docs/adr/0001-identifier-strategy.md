# ADR-0001: Identifier strategy

**Status:** Accepted, 2026-09-22

## Context

Every entity in this system needs an identifier, and the choice propagates further than it looks.
Three forces constrain it:

- **The transactional outbox (ADR-0003) needs the identifier before persistence.** An event
  written in the same transaction as the aggregate it describes must be able to reference that
  aggregate's identifier, which does not exist yet if the database generates it.
- **Cursor pagination (ADR-0005) uses the identifier as its keyset.** That requires an ordering
  that is stable and time-correlated.
- **Strict TDD in the domain requires injectable generation.** A domain test that asserts
  identity behaviour cannot depend on a random value or on the database.

A fourth force arrived later and changed the decision: **Better Auth owns several tables of its
own** (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`,
`team`, `teamMember`, plus a key table for the JWT plugin), generated into our Prisma schema by
`npx auth generate`. Those tables have their own identifier generation, so the identifier
strategy cannot be decided for our tables alone.

## Decision

**UUIDv7, generated in application code behind an `IdGenerator` port, stored in native Postgres
`uuid` columns — and the same generator is injected into Better Auth.**

- The domain defines an `IdGenerator` port. Infrastructure provides the implementation. Domain
  and application code never see the generator library.
- The identifier type is a branded type in `packages/shared-domain`, not a raw string, so the
  contract is shared by the API and, later, the mobile client. Repository adapters convert
  `string ↔ Id` at the infrastructure boundary.
- **Better Auth is configured with `advanced.database.generateId: () => uuidv7()`**, so every
  model it owns also receives a time-sortable identifier from the same source.
- **The Prisma schema that `npx auth generate` produces is adjusted so Better Auth's identifier
  columns are `id String @id @db.Uuid`.** Without this adjustment the columns become plain
  `String` (that is, `text`), because the schema generator only attaches `db.Uuid` when
  `generateId` is the literal string `"uuid"`.

## Consequences

**What it buys.** Identifiers exist before persistence, so an aggregate and its outbox events
carry the same identifiers in one transaction. Generation is injectable, so domain tests are
deterministic. One strategy covers two schemas, so identifiers are time-sortable across the whole
system and the ordering assumptions of ADR-0003 and ADR-0005 hold everywhere. Native `uuid`
columns keep the 16-byte storage and index locality that a `text` column would lose.

**What it costs.** The application clock becomes part of identifier correctness, so clock skew
and same-millisecond monotonicity are the generator's responsibility and must be handled by a
vetted implementation rather than hand-rolled. The `@db.Uuid` adjustment is a manual edit to
generated output, so **re-running `npx auth generate` reverts it** — a hazard that needs a
guard, not just a comment. And identifiers are public and reveal creation time; where that is
unwanted (displayed invoice numbers, for instance) the answer is a separate opaque display
number derived from the identifier, not a different identifier scheme.

## Alternatives considered

- **Postgres-generated UUIDv7 (`uuidv7()` as a column default).** Zero application-side generator
  risk and one source of timestamp truth. It lost on the outbox: the identifier does not exist
  until the row is written, so any flow that needs it first has to work around that.
- **ULID.** Shorter, friendlier, copy-pasteable. It lost on storage and ecosystem: as `text` it
  is bulkier and slower to index than a native `uuid`, and it leaves the Postgres and Prisma UUID
  tooling behind.
- **UUIDv4.** Rejected outright: not time-sortable, which breaks the keyset cursor and the outbox
  ordering.
- **Serial integers.** Rejected: they leak growth rate, complicate multi-writer and offline
  scenarios, and Better Auth's own `"serial"` mode forces integer identifiers across every model.
- **Better Auth's `generateId: "uuid"`.** This produces the native `uuid` column with a database
  default, and it was tempting for that reason. It lost because the default is
  `gen_random_uuid()`, which is **version 4** — random, not time-sortable — and because the
  database would generate it rather than our port.

## Verification notes

**Verified against Better Auth's source**, not its documentation:

- `packages/core/src/db/adapter/get-id-field.ts` builds the identifier field **per model** from
  the whole schema, and its `defaultValue()` carries the comment *"user-provided function takes
  highest priority"*, then calls `generateId({ model })`. Precedence read from the code:
  `disableIdGeneration` → user function → `"uuid"` → the adapter-level custom generator → the
  built-in default. A custom function therefore covers plugin models, not only the core.
- `packages/cli/src/generators/prisma.ts` derives `useUUIDs` and `useNumberId` **only from the
  string options**, and emits `db.Uuid` only in the `"uuid"` branch. With a function the
  generated field is `id String @id` with no database default, which is correct because the
  application supplies the value — and it is the reason the manual `@db.Uuid` adjustment above is
  required.

**Reasoned, still to confirm at implementation time:**

- That injecting a function does not conflict with the Prisma adapter in practice. The source
  says it should not; it has not been executed.
- Whether a test should assert the `@db.Uuid` column type so a future `npx auth generate` cannot
  silently revert the adjustment. Recommended, not yet decided.

**Known gotcha, verified in better-auth issue #5081:** returning `false` **from inside** the
`generateId` function does not let the database generate the identifier — it inserts the string
`"false"`. Only the option-level `generateId: false` delegates to the database.
