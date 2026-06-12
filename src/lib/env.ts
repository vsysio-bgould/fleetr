import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ESI_CLIENT_ID: z.string().min(1),
  ESI_CLIENT_SECRET: z.string().min(1),
  ESI_CALLBACK_URL: z.string().url(),
  PARTYKIT_SECRET: z.string().min(16),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(16).optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

/**
 * Returns the validated environment. Throws at first call if any required
 * variable is missing so that the error surfaces immediately at startup,
 * not on the first request that happens to need that variable.
 */
export function getEnv(): Env {
  if (_env) return _env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  _env = result.data;
  return _env;
}

/** Reset cached env — for tests only. */
export function _resetEnv() {
  _env = undefined;
}
