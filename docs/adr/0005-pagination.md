# ADR-0005: Pagination

**Status:** Accepted, 2026-09-22

## Context

Lists in this product grow: invoice history, stock movements, products, purchases. Two properties
matter as they grow — correctness under concurrent writes, and cost that does not degrade with
depth.

Two earlier decisions constrain the answer. ADR-0001 settled on time-sortable UUIDv7 identifiers,
which means an identifier is already a stable, ordered keyset key. ADR-0006 settles on TanStack
Query as the client cache, whose infinite query is built for a cursor contract rather than for
page numbers.

## Decision

**Cursor pagination across the public API.**

- Request: `?cursor=<id>&limit=N`. Response: `{ data, nextCursor }`.
- **The cursor is the canonical identifier** (UUIDv7, ADR-0001). When another sort is requested,
  the key is the composite `(sortKey, id)` with the identifier always the final tiebreaker, so
  the ordering is total and stable.
- **A hard limit cap** (default in the range of 25 to 50, ceiling in the range of 100 to 200),
  validated in the shared DTO layer, is part of the contract.
- **Counts are explicit and separate.** A screen that must display a total gets its own endpoint;
  no list endpoint pays for a count it does not need.
- **Offset pagination is reserved for a future superadmin surface**, if one ever genuinely needs
  jump-to-page navigation. It is not part of the public contract.

## Consequences

**What it buys.** Paging stays correct while rows are inserted or deleted: offset pagination skips
and duplicates rows under concurrent writes, and stock movements and invoices are exactly the
lists being written to while someone reads them. Cost is proportional to page size rather than to
depth. There is no server-side page state to keep, and no count query in the hot path. On the web
it maps directly onto the infinite query the client cache already provides.

**What it costs.** There is no free "jump to page 5". A screen that needs a total needs a second
request, and a screen that wants numeric page navigation is not served by this contract at all.
The cursor is an opaque token to clients, so changing the ordering later is a breaking change to
that contract.

## Alternatives considered

- **Offset and limit.** Trivial to build, allows jumping to any page, and the total comes for
  free. It lost on the two properties that matter here: deep offsets are expensive, and concurrent
  writes make the result incorrect — the same row can appear on two pages or on none.
- **Hybrid: cursor publicly, offset for admin.** This is the decision plus a second contract. It
  was kept as a reserved option rather than adopted now, because maintaining two contracts for a
  surface that does not exist yet is premature. It becomes the answer the day a superadmin screen
  needs numeric navigation.

## Verification notes

**Verified in this repository:** TanStack Table and TanStack Query are already dependencies, and
the query provider is configured with a five minute stale time, which is consistent with a
refetch-window model.

**Reasoned, to confirm at implementation time:** the current shape of TanStack Query's infinite
query API in the pinned version, and the exact default and ceiling values for the limit. Both are
small and adjustable; the contract shape is the decision.

**Deliberately not a factor:** cursor values are identifiers, which are public anyway. Keyset
pagination by identifier reveals nothing the list itself does not, so there is no information
exposure to design around here — but the cursor stays an explicit field rather than being
overloaded onto another parameter, so it can change format without changing the request shape.
