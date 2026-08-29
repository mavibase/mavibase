import type {
  RateLimitPolicy,
  RateLimitResult,
  RedisScriptClient,
} from "./types.js";

const rateLimitScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {current, redis.call('TTL', KEYS[1])}
`;

export class RedisRateLimiter {
  constructor(
    private readonly client: RedisScriptClient,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(
    policy: RateLimitPolicy,
    subject: string,
  ): Promise<RateLimitResult> {
    validatePolicy(policy);
    validateKeyPart(subject, "rate-limit subject");
    const window = Math.floor(this.now() / 1000 / policy.windowSeconds);
    const key = `rate-limit:${encodeKeyPart(policy.id)}:${encodeKeyPart(subject)}:${window}`;
    const result = await this.client.eval<unknown>(
      rateLimitScript,
      [key],
      [String(policy.windowSeconds)],
    );
    const [count, ttl] = readCounterResult(result);
    return {
      allowed: count <= policy.limit,
      count,
      remaining: Math.max(0, policy.limit - count),
      retryAfterSeconds: Math.max(1, ttl),
    };
  }
}

function validatePolicy(policy: RateLimitPolicy): void {
  validateKeyPart(policy.id, "rate-limit policy");
  if (!Number.isInteger(policy.limit) || policy.limit < 1) {
    throw new Error("Rate-limit policy limit must be a positive integer");
  }
  if (!Number.isInteger(policy.windowSeconds) || policy.windowSeconds < 1 || policy.windowSeconds > 86400) {
    throw new Error("Rate-limit policy window must be between 1 and 86400 seconds");
  }
}

function readCounterResult(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Redis rate-limit response is invalid");
  }
  const count = Number(value[0]);
  const ttl = Number(value[1]);
  if (!Number.isInteger(count) || !Number.isInteger(ttl)) {
    throw new Error("Redis rate-limit response contains invalid counters");
  }
  return [count, ttl];
}

function validateKeyPart(value: string, field: string): void {
  if (value.length === 0 || value.length > 256) {
    throw new Error(`${field} must contain between 1 and 256 characters`);
  }
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value);
}
