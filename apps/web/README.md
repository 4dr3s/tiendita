# @tiendita/web

Next.js App Router front end for TIENDITA v2. See the repository root `README.md`
for the full setup, requirements and the `docker.exe` constraint on this machine.

- Dev server: `pnpm --filter @tiendita/web dev` (port 3000)
- Build: `pnpm --filter @tiendita/web build`
- Lint: `pnpm --filter @tiendita/web lint`

Data fetching goes through TanStack Query (`app/providers/query-provider.tsx`).
There is no test task in this app yet; it arrives with the first UI logic.

The placeholder `app/favicon.ico` is still the default scaffold icon and must be
replaced with the product mark before any public deployment.
