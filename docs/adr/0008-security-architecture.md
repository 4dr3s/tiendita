# ADR-0008: Security architecture

**Status:** Accepted, 2026-09-22

## Context

Security is a cross-cutting requirement of this product, not a feature: the same deployment serves
many stores, and the worst failure this system can have is exposing one customer's data to another
or to the internet.

Several constraints shape how it can be built. The hexagonal rule forbids framework code in domain
and application, so guards, decorators and middleware cannot contain the authorization rules — they
belong in infrastructure, and the decisions they enforce belong in the application layer. Strict
TDD means a security rule has to be testable without a running server. And Better Auth already
ships its own role and permission machinery, which creates a real risk of two authorization
sources of truth.

## Decision

**The full posture below, with the denial-test rule, and with authorization owned by a policy port
in our domain.**

### Request context

Identity is resolved **once per request** in a guard — session lookup producing `requestId`,
`userId`, `organizationId`, `roles` and `authMethod` — and passed **explicitly as a parameter**
into application services rather than through ambient state. `requestId` is minted at the very
edge, echoed in logs, returned in a response header, and included in error payloads (ADR-0007).

### The organization rule

**`organizationId` is never a source of truth from the body or the URL.** The session is the
source of truth; an organization in the request is a selection hint that must be cross-checked
against membership, and a mismatch fails closed. This is the single most denial-tested rule in the
system.

### Enforcement

Application-level scoping plus row level security on business tables, as decided in ADR-0002. The
guard layer enforces that every route except an explicit whitelist (health, authentication,
public) requires a valid session, and that every tenant-scoped route additionally asserts active
membership in the resolved organization.

### Authorization: one source of truth

- **A policy port in our domain owns the authorization decision.** Better Auth owns identity,
  session and membership; the adapter translates a membership and role name into what the domain
  needs, and the domain decides. There is exactly one component that *evaluates* permission, which
  is what prevents two sources of truth.
- **Permissions live as data in our own tables** — `role`, `permission`, `role_permission` — so a
  store owner can adjust what a role may do without a deployment.
- **The split that makes that safe:** `permission` is the **system vocabulary** — global, seeded
  from code, not editable, because an owner who could invent a permission would turn the
  vocabulary into a suggestion. `role` and `role_permission` are **tenant-scoped and editable**,
  so they carry an organization identifier and are covered by row level security by construction.
- **Administering permissions is itself a permission** (`organization:roles`), held by the store
  owner within their organization and by the superadmin globally. Without it in the model,
  "managing roles" is an implicit capability of the code rather than a granted right.
- **Every permission change is audited** with actor and before/after state. An unaudited
  meta-permission is a hole in the audit trail.

### Roles

`owner`, `manager`, `cashier`, `readonly`, with `organization:settings`, `organization:members`
and `organization:roles` restricted to the owner; product writes and purchases to owner and
manager; stock movements and invoice creation to owner, manager and cashier; reads broadly; report
reads to owner, manager and readonly; billing to the owner alone.

### Superadmin

**Outside the organization model, in its own trust domain** — separate credentials and session,
audited, with global reach. It is deliberately *not* another role inside an organization, so an
authorization bug inside a tenant cannot escalate into it. Cross-tenant database access uses a
dedicated role, and only through the admin service.

### Impersonation

**Enabled, audited and reversible.** The audit trail records the impersonating actor alongside the
impersonated user, so "the user did this" is distinguishable from "an admin did this as the user".
Without that distinction the audit log becomes unusable exactly when it matters most.

### Audit

An append-only log — actor, organization, action, resource, before and after, IP, request id,
timestamp — **written in the same transaction as the mutation**. Asynchronous audit through the
outbox would lose the guarantee that the audited action and the audit entry commit together, which
is the only property that makes an audit log trustworthy. The repository exposes append and read;
there is no update or delete path.

### Rate limiting and lockout

Rate limiting is Redis-backed behind a port, so tests use an in-memory fake. Login lockout is
**tested application logic**, not adapter configuration: incremental backoff, a threshold per
organization, email and IP, and an audit entry per failure. The adapter is replaceable; the policy
is ours.

### Web and mobile surface

CSRF is largely mitigated by `SameSite` cookies, with an explicit origin check on state-changing
requests as a second layer. CORS is an allowlist for the web origin with credentials, never a
wildcard. A strict content security policy is served by the web app. Mobile tokens live in
platform secure storage (Keychain and Keystore-backed), never in plain storage, and are cleared on
logout and on revocation.

### The denial-test rule

**A security rule ships with a test that fails first, and is not considered implemented until that
test passes.** The minimum set:

1. An organization in the body or URL that contradicts the session loses, and no cross-tenant row
   is touched.
2. A protected route without a valid session returns 401 and executes nothing.
3. Row level security returns zero rows when the session variable is unset.
4. Domain and application import only their allowed dependency set.
5. Every tenant-scoped controller carries the guard.
6. Lockout fires on the attempt after the threshold, with a fake clock.
7. The audit log has no update or delete path.

## Consequences

**What it buys.** The rules are enforceable rather than aspirational: the denial tests are what
keep a small team honest under deadline pressure, and the architectural import rule turns the
hexagonal boundary from a convention into a check. Having exactly one component evaluate
authorization removes the class of bug where two systems disagree and the outer one wins. An audit
log that commits with its action is the only kind worth having.

**What it costs.** This is the most expensive ADR in the set. The policy port, the permission
tables, the audit log, the lockout logic and seven denial tests are real work, and doing all of it
before the first feature would consume the first weeks of product velocity. Runtime-editable
permissions add caching and invalidation (ADR-0006) plus an audit entry on every change. And there
is a sequencing question the ADR deliberately does not answer: which of these land with the first
tenant feature and which wait for the first deploy.

## Alternatives considered

- **Better Auth's access control as the source of truth.** It already ships roles, permissions and
  `createAccessControl`, so this is the shortest path and it avoids duplicating the library. It
  lost because it puts the authorization decision behind a library boundary that the domain cannot
  test with strict TDD, and because a store owner editing permissions is a product requirement
  that the library's model would have to be bent to fit. Better Auth stays the assignment store;
  the decision moves to our domain.
- **HTTP-first authorization: rules inside guards and decorators.** The conventional NestJS
  approach, and the fastest to write. It lost on the hexagonal rule and on testability: a rule
  inside a guard cannot be unit-tested without the framework, and the same rule would be needed by
  workers that have no request.
- **A minimal v1 without the denial-test rule**, accepting explicitly which rules would land
  untested. Considered seriously, because the cost above is real. It lost because the rule is what
  makes the rest of the posture survive contact with a deadline, and because the specific tests
  listed above are cheap once the rule exists.

## Verification notes

**Verified in this repository:** supertest is configured, so transport-level denial tests can run
end to end; the hexagonal import ban is already stated as project policy; and the pull request
template asks for tests alongside behaviour.

**Verified against Better Auth's documentation:** the admin plugin provides `ban` (which blocks
sign-in **and revokes all existing sessions**), `unban`, `impersonate` with a configurable
duration, session listing and revocation, and a `createAccessControl` role and permission system.
The organization plugin ships its **own** roles (`owner`, `admin`, `member`) and access control —
which is precisely why the decision above names one source of truth, since the library's model and
ours would otherwise both claim authority.

**Reasoned, to confirm at implementation time:** the `@nestjs/throttler` module's current state,
the current header APIs in the web framework's version, and the secure storage module for mobile.
Each is an adapter detail behind a port; none changes the posture.

**Open, deliberately:** the role model is fixed at four roles, but the permission list inside each
role is expected to be calibrated as the first features land. The vocabulary is system-owned, so
that calibration is a code change with tests, not a runtime edit.
