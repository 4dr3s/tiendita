import { HealthProbe } from "./providers/health-probe";

export default function Home() {
  return (
    <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-16 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        TIENDITA v2
      </h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Multi-tenant SaaS skeleton — Turborepo, NestJS API on :3001, Next.js
        App Router web app on :3000.
      </p>
      <HealthProbe />
    </main>
  );
}