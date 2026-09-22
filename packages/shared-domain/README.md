# @tiendita/shared-domain

Shared domain primitives for TIENDITA v2 — value objects, invariants and
cross-app domain contracts used by the API and web apps.

## Status

Empty by design in Work Unit 0.1 (monorepo skeleton, no business logic). The
first value objects arrive with the foundation ADRs (Work Unit 0.2).

## Scripts

```bash
pnpm --filter @tiendita/shared-domain build      # tsc -> dist
pnpm --filter @tiendita/shared-domain typecheck
pnpm --filter @tiendita/shared-domain lint
```