export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options: { readonly ttlSeconds: number; readonly onlyIfAbsent?: boolean },
  ): Promise<boolean>;
  del(key: string): Promise<boolean>;
  publish(channel: string, message: string): Promise<void>;
}

export interface RedisScriptClient extends RedisClient {
  eval<T>(
    script: string,
    keys: readonly string[],
    argumentsList: readonly string[],
  ): Promise<T>;
}

export interface RedisSessionState {
  readonly sessionId: string;
  readonly accountId: string;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly idleExpiresAt: number;
  readonly absoluteExpiresAt: number;
  readonly authLevel: string;
  readonly deviceId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export interface SessionInvalidationMessage {
  readonly sessionId: string;
  readonly reason: string;
  readonly occurredAt: number;
}

export interface RedisSessionStoreOptions {
  readonly keyPrefix?: string;
  readonly invalidationChannel?: string;
  readonly now?: () => number;
}

export interface LocalSessionCache {
  get(sessionId: string): RedisSessionState | undefined;
  set(session: RedisSessionState): void;
  invalidate(sessionId: string): void;
  invalidateFromMessage(message: string): boolean;
}

export interface RateLimitPolicy {
  readonly id: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly count: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export type IdempotencyState = "completed" | "failed" | "in-progress";

export interface IdempotencyRecord {
  readonly scope: string;
  readonly key: string;
  readonly fingerprint: string;
  readonly state: IdempotencyState;
  readonly resultReference: string | null;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface IdempotencyClaim {
  readonly claimed: boolean;
  readonly record: IdempotencyRecord;
}

export interface RedisCacheOptions {
  readonly keyPrefix?: string;
}

export interface UsageAggregationBufferKey {
  readonly scope: string;
  readonly metric: string;
  readonly windowStart: number;
  readonly dimensions?: Readonly<Record<string, string>>;
}

export interface UsageAggregationBufferIncrement extends UsageAggregationBufferKey {
  readonly amount: number;
  readonly ttlSeconds: number;
}

export interface UsageAggregationBufferRecord extends UsageAggregationBufferKey {
  readonly dimensions: Readonly<Record<string, string>>;
  readonly amount: number;
  readonly remainingTtlSeconds: number;
}
