# Contributing

This repository is a pnpm + turborepo monorepo. Every rule below states why it exists, so a
future change can be argued with instead of guessed at.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 24 | see `.nvmrc`; `engines.node` requires `>=24` |
| pnpm | 10.33.0 | declared in `packageManager`; run `corepack enable` |
| Docker | current Desktop | see the WSL note below |

**On WSL over an NTFS checkout, the `docker` client does not work.** There is no
`/var/run/docker.sock`, so use `docker.exe`:

```sh
docker.exe compose -f docker/compose.yaml up -d
```

CI runs on Linux and uses plain `docker`. `docker.exe` must never appear in a
`package.json` script or in a workflow step, or the pipeline breaks and the failure looks
like a Docker problem when it is not.

## Getting started

```sh
corepack enable
pnpm install
docker.exe compose -f docker/compose.yaml up -d   # postgres on 55432, redis on 56379
pnpm dev                                          # turbo runs every dev task
```

## Checks

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose -f docker/compose.yaml config -q   # docker.exe on WSL
```

CI (`.github/workflows/ci.yml`) runs exactly this set. Anything green locally should be green
there; when it is not, that difference is itself a bug worth an issue.

## Commits

Conventional Commits, checked by commitlint through a husky hook:

```
<type>(<optional scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`.

The hook is convenience and `git commit --no-verify` bypasses it. What actually enforces the
convention is the `commit-message` CI job, which lints the **pull request title** — because
merging is squash-only, the title is what becomes the commit on `main`.

## Pull requests

1. Branch from `main`. Never push to `main` directly; it is protected.
2. Open a pull request and write the title as a Conventional Commit.
3. Wait for `verify` to be green. A red pipeline means the pull request cannot merge.
4. Merging is **squash only**, so `main` keeps one commit per pull request and a linear
   history. The internal commits of the branch are discarded by design.
5. Write the body for whoever reads `main` in a year: what changed, why, how it was
   verified, and how to roll it back.

`main` requires one approval. On a single-maintainer repository GitHub does not allow
self-approval, so the owner merges through the ruleset's bypass list, and every bypass is
recorded in the repository audit log.

## Tests

Strict TDD applies to the domain and application layers: a test that fails first, then the
code that makes it pass. Infrastructure adapters (Prisma, Better Auth, Telegram, LLM
clients, queues) are covered by integration tests instead.

A purely structural change — configuration, tooling, file layout — has no layer to test
first. Its verification is the command set above, and the pull request must say so
explicitly rather than leave the missing RED step looking like an oversight.

## Documentation

Design decisions belong in `docs/adr/` as numbered ADRs. Work-unit tracking lives outside
version control, in the maintainer's ODD ledger (`odd/` is gitignored by decision) — which
is exactly why the pull request body is the durable in-repository record of a change.
