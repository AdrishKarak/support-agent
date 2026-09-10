interface WindowCounter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, WindowCounter>();

/**
 * Small in-process circuit breaker for the public demo endpoint. In a
 * multi-instance deployment this should be replaced with a shared store.
 */
export function takeRequestQuota(
  key: string,
  limit = 20,
  windowMs = 60_000,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const current = counters.get(key);
  if (!current || now >= current.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearRequestQuotasForTest(): void {
  counters.clear();
}
