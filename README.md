# TIENDITA v2

TIENDITA v2 is a multi-tenant SaaS for small stores: organizations with
superadmin trials, Telegram stock alerts, internal invoicing with QR codes,
OCR/LLM-assisted product registration, Redis-backed queues, and an Expo mobile
app. This repository is the v2 web/backend monorepo.

**Status:** Work Unit 0.1 — monorepo skeleton. No business logic yet. Domain
code, Prisma, auth, queues and the mobile app land in later work units. The
work-unit ledger is maintained outside version control.

## Layout

```
apps/
  api/                 NestJS 11 REST API (port 3001)
  web/                 Next.js App Router web app (port 3000)
packages/
  eslint-config/       Shared ESLint 9 flat config
  shared-domain/       Shared domain primitives (empty in 0.1)
  typescript-config/   Shared strict TypeScript configs (base, nestjs, nextjs)
docker/
  compose.yaml         Local infra: postgres 18 + redis 7
```

## Requirements

- Node.js >= 24 (developed on 25.x)
- pnpm 10.33.0 (pinned in `package.json` via `packageManager`)
- Docker Desktop on the host. **On WSL the bare `docker` client does not work —
  use `docker.exe` for every Docker command.**

## Install

```bash
pnpm install
```

## Local infrastructure

```bash
docker.exe compose -f docker/compose.yaml up -d
docker.exe compose -f docker/compose.yaml ps
```

- `tiendita-v2-postgres` on host port `55432` → container `5432`
- `tiendita-v2-redis` on host port `56379` → container `6379`

The ports and names differ from the defaults on purpose: this host already has
a stale postgres attempt (container `tiendita-postgres`, orphan volume
`tiendita_postgres_data`) and a WSL `redis-server` occupying `6379`. Reusing
either would silently serve stale data or fail to bind.

## Run

```bash
pnpm dev                            # api on :3001 and web on :3000 via turbo
pnpm --filter @tiendita/api dev     # API only
pnpm --filter @tiendita/web dev     # Web only
```

Health check: `curl http://127.0.0.1:3001/health`.

## Validate

```bash
pnpm typecheck
pnpm lint
pnpm test        # API unit tests (web has no test task in 0.1)
pnpm build
pnpm format
```

## Environment

`.env.example` documents the only variables consumed today (`NODE_ENV`,
`PORT`). The API reads them through `@nestjs/config` plus a zod schema that
fails fast on invalid values and requires no database or other infrastructure
to boot. Future variables (database, redis, auth, telegram, LLM keys) are
listed commented out for visibility only.

## License

MIT — see [LICENSE](LICENSE).