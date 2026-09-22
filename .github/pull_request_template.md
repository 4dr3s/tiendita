<!--
The title of this pull request becomes the commit subject on `main`: merging is squash-only.
Write it as a Conventional Commit, for example:

  feat(inventory): add bulk stock adjustment
-->

## What

## Why

## How it was verified

<!--
Raw evidence beats assertions. Name the commands you ran and paste the result, or state
plainly what you did not verify. "It works" is not verification, and a green local build
is not a review.
-->

## Risk and rollback

<!-- What can go wrong, how you would notice, and how you would undo it. -->

## Checklist

- [ ] `pnpm install --frozen-lockfile` succeeds (the lockfile is committed and current)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green
- [ ] If `docker/compose.yaml` changed: `docker compose -f docker/compose.yaml config` is valid
- [ ] Tests landed with the behaviour (strict TDD in the domain and application layers)
- [ ] No `docker.exe` was added to anything CI executes
- [ ] Documentation updated when a rule or a convention changed
