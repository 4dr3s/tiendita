# ADR-0006: Cache and invalidation

**Status:** Accepted, 2026-09-22

## Context

Stock levels change from two directions. A user changes them through the application, and a
background worker changes them — OCR-assisted product registration, a Telegram command, a bulk
import, and later a point-of-sale sync. A cache that only knows about the first direction shows
stale numbers precisely when the second one runs.

The forces:

- **Stock is authoritative in Postgres and changes during sales.** Any server-side cache in front
  of it creates a second source of truth with a staleness window at the worst possible moment.
- **The client already has a cache.** TanStack Query is configured on the web with a five minute
  stale time.
- **The question that actually decides this is a product question**, not a technical one: is live,
  multi-device stock a launch promise? If it is, the freshness mechanism has to exist from the
  start rather than being retrofitted once query shapes are tuned around polling.

## Decision

**Client-first caching, no server-side cache in front of authoritative stock, version counters for
derived data, and server-sent events adopted now.**

- **TanStack Query is the primary cache**, with per-screen staleness policies, refetch on window
  focus, and a documented query-key convention. Invalidation is only as good as key discipline, so
  the convention is fixed before the first feature rather than after.
- **Never a server-side cache in front of stock**, on either the read or the write path. Staleness
  tolerance lives in the client; freshness lives in the refetch window and in the push below.
- **Version counters for derived and expensive data** — dashboards and aggregates — bumped by the
  same path that mutates, including workers.
- **Server-sent events, adopted now.** Worker-originated changes reach connected clients without a
  reload. This answers the product question above: live multi-device stock is a launch promise.
- **All writes go through the same application service**, whether they originate from a user or a
  worker, so the outbox event (ADR-0003) is emitted uniformly and the invalidation story is
  event-shaped even where the delivery is a refetch.
- **HTTP caching:** tenant data is private, so no shared caches. Sensitive endpoints are
  `private, no-store`; a cacheable endpoint is a conscious trade of freshness for latency, never
  the default, and never stock.

## Consequences

**What it buys.** No second source of truth for inventory. The client cache is already the web
client's paradigm, so most screens need no additional machinery. Worker-originated changes appear
in near real time, which is the difference between a stock screen that feels live and one that
feels broken.

**What it costs.** Server-sent events are a second transport contract to test: connection
lifecycle, reconnection, heartbeats, and a fan-out path. With more than one API instance the
fan-out needs a Redis publish/subscribe bridge; a single instance does not need it today, but the
consumer contract in ADR-0003 was written to leave room for it. Version counters that drift are a
classic source of "why did this not invalidate" bugs, so they need their own tests.

**The specific rule that falls out of the stock problem:** because stock is authoritative in
Postgres and is written by both users and workers, there is no cache layer to invalidate — there
is only the client's tolerance and the push. That removes an entire category of bug rather than
managing it.

## Alternatives considered

- **Client-first with server-sent events deferred.** The recommended option in the original
  analysis, on the grounds that push machinery is real surface for a small team and should be
  added when a requirement demands it. It lost to the product answer: if live multi-device stock
  is a launch promise, deferring means retrofitting push under pressure while query shapes are
  already tuned to polling.
- **A server-side Redis cache of stock levels.** Rejected outright. It creates a second source of
  truth with a staleness window during sales, which is the one place where staleness is least
  acceptable and hardest to explain to a store owner.
- **Version counters only, without push.** Cheaper than server-sent events and still stateless.
  It lost because a counter still needs a trigger: without push, the trigger is a refetch window,
  which is the staleness the product answer rejected. It survives in the decision for derived
  data, where a window is acceptable.

## Verification notes

**Verified in this repository:** TanStack Query is wired with a five minute stale time in the web
app's query provider, and TanStack Table is a dependency.

**Reasoned, to confirm at implementation time:** the mechanics of server-sent events in the pinned
NestJS version, the Redis publish/subscribe bridge shape for multiple instances, and the exact
freshness budget per screen. None of these was executed.

**Open, deliberately:** the freshness budget per screen. The decision fixes the mechanism; the
per-screen numbers are a product calibration that belongs with each screen, not in an ADR.
