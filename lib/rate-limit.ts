import { ApiError } from "./api-security.ts";
import { sha256 } from "./auth.ts";

/** Counts requests per key in fixed windows; returns the count including this one. */
export interface RateLimitStore {
  hit(key: string, windowStart: number): Promise<number> | number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const LIMITS = {
  /** Orders one visitor can send to any restaurant. */
  orderPerIp: {
    limit: 20,
    windowMs: 10 * MINUTE,
    message: "Too many orders from this connection. Please wait a few minutes.",
  },
  /** Sign-in codes one email address can receive per day. */
  codePerEmail: {
    limit: 10,
    windowMs: 24 * HOUR,
    message: "Too many sign-in codes for this email today. Try again tomorrow.",
  },
  /** Sign-in codes one visitor can request, across all emails. */
  codePerIp: {
    limit: 30,
    windowMs: HOUR,
    message: "Too many sign-in requests from this connection. Try again later.",
  },
  /** Code guesses one visitor can make, across all emails. */
  verifyPerIp: {
    limit: 30,
    windowMs: 10 * MINUTE,
    message: "Too many sign-in attempts. Please wait a few minutes.",
  },
} as const;

/**
 * Throws 429 once `subject` (an IP address or email) passes the limit. Only a
 * hash of the subject is stored, and rows only matter for one window.
 */
export async function enforceLimit(
  store: RateLimitStore,
  name: keyof typeof LIMITS,
  subject: string,
  now = Date.now(),
): Promise<void> {
  const { limit, windowMs, message } = LIMITS[name];
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const count = await store.hit(
    `${name}:${await sha256(subject)}`,
    windowStart,
  );
  if (count > limit) throw new ApiError(message, 429);
}

/** SQL shared by D1 and node:sqlite: start a new window or count within it. */
export const RATE_LIMIT_HIT_SQL =
  "INSERT INTO rate_limits(key, window_start, count) VALUES(?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END, window_start = excluded.window_start RETURNING count";
/** Rows older than the longest window are useless; removed occasionally. */
export const RATE_LIMIT_CLEANUP_SQL =
  "DELETE FROM rate_limits WHERE window_start < ?";
export const RATE_LIMIT_MAX_WINDOW_MS = 24 * HOUR;
