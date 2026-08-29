import type { RedisCacheOptions, RedisClient } from "./types.js";

const defaultKeyPrefix = "cache:";

export class RedisDistributedCache {
  private readonly keyPrefix: string;

  constructor(
    private readonly client: RedisClient,
    options: RedisCacheOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? defaultKeyPrefix;
  }

  async get<T>(
    key: string,
    guard: (value: unknown) => value is T,
  ): Promise<T | undefined> {
    const value = await this.client.get(this.redisKey(key));
    if (value === null) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!guard(parsed)) {
        await this.invalidate(key);
        return undefined;
      }
      return parsed;
    } catch {
      await this.invalidate(key);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    validateKey(key);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 86400) {
      throw new Error("Cache TTL must be between 1 and 86400 seconds");
    }
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error("Cache value must be JSON serializable");
    }
    const stored = await this.client.set(
      this.redisKey(key),
      serialized,
      { ttlSeconds },
    );
    if (!stored) {
      throw new Error(`Redis refused to store cache key: ${key}`);
    }
  }

  async invalidate(key: string): Promise<void> {
    validateKey(key);
    await this.client.del(this.redisKey(key));
  }

  private redisKey(key: string): string {
    validateKey(key);
    return `${this.keyPrefix}${encodeURIComponent(key)}`;
  }
}

function validateKey(key: string): void {
  if (key.trim().length === 0 || key.length > 512) {
    throw new Error("Cache key must contain between 1 and 512 characters");
  }
}
