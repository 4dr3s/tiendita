# Architecture Decision Records

One file per decision, numbered, never renumbered, never deleted. A decision that is replaced is
marked `Superseded by ADR-XXXX` instead of being removed: the record of a wrong answer is what
stops the same reasoning from being repeated.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-identifier-strategy.md) | Identifier strategy | Accepted, 2026-09-22 |
| [0002](0002-tenancy.md) | Tenancy and data isolation | Accepted, 2026-09-22 |
| [0003](0003-event-engine.md) | Event engine: outbox and delivery | Accepted, 2026-09-22 |
| [0004](0004-authentication.md) | Authentication and session model | Accepted, 2026-09-22 |
| [0005](0005-pagination.md) | Pagination | Accepted, 2026-09-22 |
| [0006](0006-cache-invalidation.md) | Cache and invalidation | Accepted, 2026-09-22 |
| [0007](0007-error-taxonomy.md) | Error taxonomy | Accepted, 2026-09-22 |
| [0008](0008-security-architecture.md) | Security architecture | Accepted, 2026-09-22 |

## Decision order

The numeric order is not the order in which these had to be decided. The dependencies between
them are:

- **0001 first.** It fixes the identifier format, which 0005 uses as its keyset cursor and 0003
  uses to order the outbox.
- **0002 and 0008 are one purchase.** The enforcement story (application-level scoping plus row
  level security) and the guard/request-context story only make sense together, and their denial
  tests overlap.
- **0003 and 0006 share the event bus.** The "a worker changed stock" invalidation is an outbox
  consumer, so the invalidation listener belongs to the outbox consumer contract rather than
  being bolted on afterwards.
- **0004 defines what 0008's guard can resolve.** The session model determines what the request
  context can carry.

## Template

Every ADR carries the same sections so they can be read and compared:

- **Status** — `Accepted` with a date, or `Superseded by ADR-XXXX`.
- **Context** — the forces that make this a decision rather than an obvious choice.
- **Decision** — what was decided, in the present tense.
- **Consequences** — what it buys and what it costs. Both, always.
- **Alternatives considered** — what lost, and why. An ADR that records only the chosen option
  is a rationalisation, not a record.
- **Verification notes** — what is verified against a source or the repository, and what is
  reasoned and still needs confirming.

## Adding one

Number it after the highest existing number. Never renumber. If it replaces an earlier decision,
update that one's status rather than editing its content.
