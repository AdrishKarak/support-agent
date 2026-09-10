/**
 * LRU Cache utility for caching expensive operations.
 * Used for embedding caching and pipeline response caching
 * to reduce redundant API calls and improve latency.
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  /**
   * @param maxSize Maximum number of entries in the cache
   * @param ttlMs Time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete existing entry to refresh position
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton caches for the application
// Embedding cache: avoids re-embedding identical queries
export const embeddingCache = new LRUCache<number[]>(200, 10 * 60 * 1000);

// Pipeline response cache: caches full pipeline responses for identical messages
export const pipelineCache = new LRUCache<any>(50, 5 * 60 * 1000);
