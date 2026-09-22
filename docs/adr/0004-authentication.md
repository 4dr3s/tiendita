# ADR-0004: Authentication and session model

**Status:** Accepted, 2026-09-22

## Context

Authentication must serve two transports from one service: a browser and, later, a mobile app.
Better Auth is already chosen and provides identity, sessions, and the organization and admin
plugins this system needs.

The decision looked like "sessions or JWT" until the documentation was read carefully, and that
framing turned out to be wrong: **Better Auth provides both.** It has a `jwt()` plugin that
exposes a token endpoint and a JWKS endpoint for verifying tokens, and it has a separate bearer
plugin for clients that do not carry cookies. The two are not alternatives to each other.

The plugin's own documentation is explicit about what it is for:

> The JWT plugin provides endpoints to retrieve a JWT token and a JWKS endpoint to verify the
> token. **This plugin is not meant as a replacement for the session.** It's meant to be used for
> services that require JWT tokens.

## Decision

**Better Auth's session token authenticates our own API, with the bearer plugin for mobile. The
`jwt()` plugin stays available but unused.**

- **Web:** the session cookie, `httpOnly` + `Secure` + `SameSite`.
- **Mobile:** the bearer plugin, resolving to the **same session row** as the web transport.
- **Revocation is deleting the session row**, which takes effect immediately for both transports
  and requires no blacklist.
- **No self-minted JWT layer.** We do not own key generation, rotation, reuse detection, clock
  skew handling or `jti` semantics.
- **`jwt()` is available for a future external service** that needs JWKS-verifiable tokens. It is
  not enabled now, because nothing consumes it.
- **Better Auth lives entirely in infrastructure**, behind an application port that resolves the
  current identity, organization membership and roles. No `better-auth` import crosses into
  domain or application.

## Consequences

**What it buys.** The library owns the security-sensitive machinery: token hashing, rotation and
expiry. Revocation is a database delete, which is the strongest primitive available and is
strictly better than a short token lifetime plus a blacklist. There is one session concept across
both transports, no signing key to manage, and no security-critical code in our test scope.
Sessions in Postgres also mean a Redis flush cannot log everyone out.

**What it costs.** Every request performs a session lookup, which an indexed table handles and a
cache can optimise later. There is no stateless verification: a worker or a future service cannot
verify a user token without a round trip to the session store, and the answer for machine
identity is service credentials rather than user tokens. And **"JWT" has to be dropped from the
stated stack plan as an authentication mechanism**, which is a deliberate reversal of a plan item
rather than an oversight.

## Alternatives considered

- **A self-minted JWT access token plus a rotating refresh token, with Better Auth as the identity
  provider only.** It buys stateless verification anywhere with the public key, full control of
  the claims, and independence from the library's session internals. It lost because the
  stateless benefit is nearly worthless inside one monolith that has a session store anyway, while
  the cost is owning the most attackable code in the system — rotation, reuse detection, key
  storage — all inside our test scope, with weaker revocation.
- **`jwt()` as the primary mechanism for both transports.** This was the user's challenge to the
  original framing, and the documentation settled it: the plugin does not replace the session, so
  a session exists underneath either way. Making it primary would add a second token concept on
  top of the one that already exists, for no consumer that needs it.
- **A hybrid: native session for web plus an exchange endpoint minting a bearer for mobile.** This
  is essentially the decision, but with hand-written plumbing. It lost because the bearer plugin
  is the documented first-class path for non-cookie clients, so the plumbing is unnecessary.

## Verification notes

**Verified against Better Auth's documentation:**

- The `jwt()` plugin exposes `/token` and `/jwks`, produces JWKS-verifiable tokens (Ed25519 by
  default), and carries the quoted statement above about not replacing the session.
- A **separate bearer plugin** exists as the documented path for clients that do not use cookies,
  which is what makes the mobile transport first-class rather than custom.
- The admin plugin provides `ban` (which blocks sign-in **and revokes all existing sessions**),
  `unban`, `impersonate` (one hour by default, configurable), session listing and revocation, and
  a `createAccessControl` role and permission system.

**Reasoned, to confirm at implementation time:** the exact session rotation semantics, the cookie
attribute defaults, and the NestJS integration pattern. Better Auth's Express adapter is the usual
mount point and NestJS integration is generally do-it-yourself, so the adapter shape needs to be
designed rather than assumed.

**Correction recorded deliberately.** The first version of this analysis presented "native
sessions versus building your own JWT engine" as the choice. The user identified it as a false
dichotomy, and the documentation confirmed he was right. The wrong first answer is kept here
because the reasoning that produced it — treating a library's optional plugin as a gap to fill —
is a mistake worth not repeating.
