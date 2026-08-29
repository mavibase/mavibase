import type {
  IdempotencyClaim,
  IdempotencyRecord,
  RedisClient,
} from "./types.js";

const defaultKeyPrefix = "idempotency:";

export class RedisIdempotencyStore {
  constructor(
    private readonly client: RedisClient,
    private readonly keyPrefix: string = defaultKeyPrefix,
    private readonly now: () => number = Date.now,
  ) {}

  async claim(
    scope: string,
    key: string,
    fingerprint: string,
    ttlSeconds: number,
  ): Promise<IdempotencyClaim> {
    validateText(scope, "idempotency scope");
    validateText(key, "idempotency key");
    validateText(fingerprint, "idempotency fingerprint");
    validateTtl(ttlSeconds);
    const createdAt = this.now();
    const record: IdempotencyRecord = {
      scope,
      key,
      fingerprint,
      state: "in-progress",
      resultReference: null,
      createdAt,
      expiresAt: createdAt + ttlSeconds * 1000,
    };
    const redisKey = this.redisKey(scope, key);
    const claimed = await this.client.set(
      redisKey,
      JSON.stringify(record),
      { ttlSeconds, onlyIfAbsent: true },
    );
    if (claimed) {
      return { claimed: true, record };
    }
    const existing = await this.read(redisKey);
    if (existing === undefined) {
      throw new Error("Idempotency record disappeared during claim");
    }
    return { claimed: false, record: existing };
  }

  async complete(
    scope: string,
    key: string,
    fingerprint: string,
    state: "completed" | "failed",
    resultReference: string | null,
  ): Promise<IdempotencyRecord> {
    const redisKey = this.redisKey(scope, key);
    const existing = await this.read(redisKey);
    if (existing === undefined) {
      throw new Error("Idempotency record not found");
    }
    if (existing.fingerprint !== fingerprint) {
      throw new Error("Idempotency fingerprint mismatch");
    }
    if (existing.expiresAt <= this.now()) {
      throw new Error("Idempotency record expired");
    }
    const updated: IdempotencyRecord = {
      ...existing,
      state,
      resultReference,
    };
    const remainingSeconds = Math.ceil((existing.expiresAt - this.now()) / 1000);
    const stored = await this.client.set(redisKey, JSON.stringify(updated), {
      ttlSeconds: remainingSeconds,
    });
    if (!stored) {
      throw new Error("Redis refused to update idempotency record");
    }
    return updated;
  }

  async get(scope: string, key: string): Promise<IdempotencyRecord | undefined> {
    return this.read(this.redisKey(scope, key));
  }

  private redisKey(scope: string, key: string): string {
    validateText(scope, "idempotency scope");
    validateText(key, "idempotency key");
    return `${this.keyPrefix}${encodeURIComponent(scope)}:${encodeURIComponent(key)}`;
  }

  private async read(key: string): Promise<IdempotencyRecord | undefined> {
    const value = await this.client.get(key);
    if (value === null) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!isIdempotencyRecord(parsed)) {
        throw new Error("invalid record");
      }
      return parsed;
    } catch {
      throw new Error("Redis idempotency record is invalid");
    }
  }
}

function validateText(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 512) {
    throw new Error(`${field} must contain between 1 and 512 characters`);
  }
}

function validateTtl(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 86400) {
    throw new Error("Idempotency TTL must be between 1 and 86400 seconds");
  }
}

function isIdempotencyRecord(value: unknown): value is IdempotencyRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.scope === "string"
    && typeof record.key === "string"
    && typeof record.fingerprint === "string"
    && ["completed", "failed", "in-progress"].includes(String(record.state))
    && (record.resultReference === null || typeof record.resultReference === "string")
    && typeof record.createdAt === "number"
    && typeof record.expiresAt === "number";
}
