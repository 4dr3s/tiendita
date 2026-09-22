# ADR-0007: Error taxonomy

**Status:** Accepted, 2026-09-22

## Context

Errors have to travel from domain rules to an HTTP response, and later to a mobile client and to
background workers that have no HTTP at all. Without a decision, transport concerns leak inward:
a service throws a framework exception, a domain test has to simulate a web framework, and a
worker inherits a taxonomy designed for a protocol it does not speak.

Two constraints frame the answer. The hexagonal rule forbids `@nestjs/*` in domain and
application, so HTTP exceptions cannot be the domain's error type. And strict TDD means domain
tests must assert error identity in a way that does not depend on a status code.

## Decision

**Typed domain errors carrying stable codes, with a single mapping at the transport boundary.**

- **Domain and application throw typed errors** — for example `InsufficientStock`,
  `OrganizationNotActive`, `QuantityNegative` — each carrying a **stable machine-readable code**
  and optional structured parameters. They never carry an HTTP status.
- **One exception filter at the transport boundary** maps error to status to response. Transport
  errors raised by the framework (validation, rate limiting, unmatched routes) are folded into the
  same shape there.
- **Response envelope:** `{ error: { code, message, requestId } }`, with `fieldErrors` for
  validation failures.
- **Codes are the contract; messages are not.** Messages are default human text, replaceable by
  localisation later, and never asserted by a client. Stack traces and database text never reach a
  client: an unexpected error produces a generic response, with the detail correlated server-side
  through `requestId`.
- **An architectural denial test forbids `@nestjs/*` and `HttpException` in domain and
  application**, so the rule is enforced rather than agreed.

## Consequences

**What it buys.** Domain tests assert error identity and parameters, not protocol. The mapping is
one visible place to review, so a new status code cannot appear anywhere else. Clients key off
stable codes rather than message text, which means copy can change without breaking them. The
`requestId` ties an error response to the logs and to the audit trail (ADR-0008).

**What it costs.** A registry that has to be kept in sync: an error added without a mapping
degrades silently into the generic path, so the mapping table needs its own test. And a code
vocabulary is a public contract — removing or renaming one is a breaking change, which is a real
constraint on refactoring that a stringly-typed error does not have.

## Alternatives considered

- **HTTP-first: services throw framework exceptions directly.** Faster to write, no registry, no
  mapping. It lost because it puts transport concepts in the inner layers, forces domain tests to
  simulate a framework, and makes domain logic unusable by the workers that have no HTTP at all.
- **A flat enum of codes with no error classes.** Lighter and easy to snapshot-test. It lost
  because structured parameters are genuinely useful — which field failed validation, what
  quantity was too low — and bolting them onto a flat enum produces the class hierarchy it was
  avoiding. In practice this option grows into the decision.
- **Bare HTTP status with no envelope.** Simplest possible contract. It lost on the client side:
  a form needs to know which field failed, and a mobile retry policy needs to distinguish
  "insufficient stock" from "not allowed" without parsing prose.

## Verification notes

**Verified in this repository:** supertest is configured, so the boundary behaviour can be tested
end to end at the transport layer, and the pull request template already asks for tests alongside
behaviour.

**Reasoned, to confirm at implementation time:** that `no-restricted-imports` in the shared ESLint
configuration is the cheapest way to enforce the architectural denial test, and the exact filter
implementation in the pinned NestJS version.

**Decided here, not deferred:** the envelope shape and the inclusion of `fieldErrors`. Both are
public contract surface that is expensive to change once a client depends on it, which is why
they are part of the decision rather than the implementation.
