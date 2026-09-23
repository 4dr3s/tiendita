# ADR-0003: Event engine: outbox and delivery

**Status:** Accepted, 2026-09-22

## Context

Several things happen as a consequence of a stock change: Telegram notifications, cache
invalidation for connected clients, and later OCR processing and reporting aggregates. Writing
those consequences inside the request is a dual write: the database commit can succeed while the
queue write fails, or the reverse, and the events lost that way are exactly the ones that matter.

The forces:

- **Durability.** An event must not be lost because the process died between the commit and the
  enqueue.
- **A small team.** Whatever machinery the delivery layer needs — retry, backoff, dead-lettering,
  observability — is either provided or written by hand.
- **Redis is already in the stack** as a queue transport, and Postgres is already the source of
  truth.
- **ADR-0006 chose server-sent events**, so the invalidation push is now part of what the delivery
  layer carries, not an afterthought.

## Decision

**A transactional outbox in Postgres, delivered by a poller into BullMQ, with the dead-letter
contract decided here rather than left to emerge.**

- **The outbox row is written in the same Prisma transaction as the aggregate.** That is the whole
  point: either both exist or neither does.
- **The poller claims batches with `FOR UPDATE SKIP LOCKED`**, so several pollers can run without
  coordinating.
- **BullMQ is the transport**, behind a port. Domain and application code see an outbox-writing
  port and an event-handler contract; the queue library, the poller and the dead-letter replay are
  infrastructure.
- **Ordering contract, stated honestly: strict within an aggregate, best-effort across
  aggregates.** Per-aggregate order is enforced with a version check on the aggregate, which also
  kills stale out-of-order writers. Global ordering is not a requirement of this product.
- **Delivery is at-least-once, so consumers must be idempotent.** Deduplication is durable: a
  `processed_events (consumer, event_id)` unique constraint in Postgres, not a Redis set with a
  time to live.
- **Dead-letter contract:** after N attempts with exponential backoff, the entry moves to a
  dead-letter queue, an alert fires, and a replay command exists. Parked entries with no
  observability is the classic failure mode of an outbox.

## Consequences

**What it buys.** No dual write: an event exists exactly when the state change that produced it
exists. Retry, backoff, rate limiting and job lifecycle come from a library rather than from our
own tested-by-hand code, which is the deciding factor for a small team. Redis stays a transport
while Postgres stays the source of truth, which is the correct division of responsibility.

**What it costs.** The abstraction leaks if anyone treats a queue job as the source of truth
rather than as transport. Some operational questions ("where did this job go?") are answered in
Redis state that SQL cannot query, so the Postgres outbox and the dead-letter queue both need to
be inspectable. And per-entity strict ordering beyond what a single consumer per queue gives
requires sharding queues by aggregate type — a design we own.

**Addendum, same day.** Because ADR-0006 adopted server-sent events, the consumer contract now
also carries cache invalidation pushes, and fan-out across more than one API instance will need a
Redis publish/subscribe bridge. Neither is needed with a single instance today, but the consumer
contract is written to leave room for both rather than being retrofitted.

## Alternatives considered

- **Raw Redis Streams with consumer groups.** Total control: pending-entry tracking makes
  consumption visible and resumable, and the dead-letter queue is just another stream. It lost on
  team size — retry with backoff, dead-letter routing, alerting and recovery tooling would all be
  written and tested by us, and that is real recurring code.
- **No outbox: write to Redis inside the request.** The simplest happy path. It lost because it
  reintroduces exactly the dual-write inconsistency the outbox exists to remove, and it contradicts
  the reliability requirement this system is being built around.
- **An external broker (RabbitMQ, Kafka).** Rejected at this scale: a whole additional piece of
  infrastructure to operate for the event volume of a small-store SaaS. The escape hatch is that
  the outbox is the pivot point — if a broker ever becomes necessary, the outbox is where it
  plugs in.

## Verification notes

**Reasoned, to confirm at implementation time:** the exact mechanism for claiming batches with
Prisma (`$queryRaw` with `FOR UPDATE SKIP LOCKED`), BullMQ's current capabilities and its fit with
the pinned Redis version, and NestJS integration patterns for the worker. None of these was
executed or verified against current documentation.

**Decided here, not deferred:** the ordering contract, the idempotency mechanism, and the
dead-letter contract. These are the parts that are expensive to change later, which is why they
are in the decision rather than in the implementation.
