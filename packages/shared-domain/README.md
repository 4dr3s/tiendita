# @tiendita/shared-domain

Shared domain primitives for TIENDITA v2 — value objects, invariants and
cross-app domain contracts used by the API and web apps.

## What it ships

- `Id` — the id value object: a phantom-branded UUIDv7 `string` with one entry
  point, `Id.parse`, backed by `idSchema` (zod 4 `z.uuidv7()`, canonical
  lowercase normalisation). `Id` works both as a value and as a type.
- `IdGenerator` — the synchronous port for minting identifiers. It returns
  `Id`, never `string`; the adapter belongs to infrastructure (ADR-0001).
- `DomainError`, `ERROR_MESSAGES`, `ErrorCode`, `ErrorCodeMap` — table-driven
  domain errors: stable, machine-readable codes, typed params, default human
  messages. No HTTP status — the transport boundary maps code to status
  (ADR-0007).

## Boundary

Framework-free by contract (ADR-0007): no `@nestjs/*`, no `@prisma/client`,
no `better-auth`, no `express`. `zod` is the only runtime dependency.

## Module format

ESM (`"type": "module"`). The public entry point is declared in `exports`
(`types` → `./dist/index.d.ts`, `default` → `./dist/index.js`); deep imports
are not part of the surface.

## Scripts

```bash
pnpm --filter @tiendita/shared-domain build       # tsc -> dist
pnpm --filter @tiendita/shared-domain typecheck   # tsc --noEmit
pnpm --filter @tiendita/shared-domain test        # jest (ESM)
pnpm --filter @tiendita/shared-domain test:watch  # jest --watch
pnpm --filter @tiendita/shared-domain test:cov    # jest --coverage
pnpm --filter @tiendita/shared-domain lint        # eslint
pnpm --filter @tiendita/shared-domain format      # prettier
```