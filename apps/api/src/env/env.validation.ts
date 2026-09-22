import { z } from "zod";

/**
 * Environment variables consumed by Work Unit 0.1.
 *
 * Only `NODE_ENV` and `PORT` are read today; everything else (database, redis,
 * auth, telegram, LLM keys) is intentionally absent so the API boots with no
 * infrastructure at all. Invalid values make `validateEnv` throw — the app
 * fails fast instead of booting in a broken state.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const detail = JSON.stringify(parsed.error.issues, null, 2);
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  return parsed.data;
}