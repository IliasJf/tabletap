import { env } from "cloudflare:workers";
import {
  RATE_LIMIT_CLEANUP_SQL,
  RATE_LIMIT_HIT_SQL,
  RATE_LIMIT_MAX_WINDOW_MS,
  type RateLimitStore,
} from "./rate-limit";

/** D1-backed counters for production spam limits. */
export function d1RateLimitStore(): RateLimitStore {
  const db = env.DB;
  if (!db) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return {
    async hit(key, windowStart) {
      // Occasional cleanup keeps the table small without a scheduled job.
      if (Math.random() < 0.01)
        await db
          .prepare(RATE_LIMIT_CLEANUP_SQL)
          .bind(Date.now() - RATE_LIMIT_MAX_WINDOW_MS)
          .run();
      const row = await db
        .prepare(RATE_LIMIT_HIT_SQL)
        .bind(key, windowStart)
        .first<{ count: number }>();
      return row?.count ?? 1;
    },
  };
}

/** Cloudflare sets this header itself; visitors can't spoof it on Workers. */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
