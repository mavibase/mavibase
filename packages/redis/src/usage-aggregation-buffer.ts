import type {
  RedisScriptClient,
  UsageAggregationBufferIncrement,
  UsageAggregationBufferKey,
  UsageAggregationBufferRecord,
} from "./types.js";

const defaultKeyPrefix = "usage-buffer:";

const incrementScript = `
local current = redis.call('INCRBYFLOAT', KEYS[1], ARGV[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  ttl = redis.call('TTL', KEYS[1])
end
return {current, ttl}
`;

const readScript = `
local value = redis.call('GET', KEYS[1])
if value == false then
  return {false, -2}
end
return {value, redis.call('TTL', KEYS[1])}
`;

export class RedisUsageAggregationBuffer {
  constructor(
    private readonly client: RedisScriptClient,
    private readonly keyPrefix: string = defaultKeyPrefix,
  ) {}

  async increment(
    input: UsageAggregationBufferIncrement,
  ): Promise<UsageAggregationBufferRecord> {
    validateIncrement(input);
    const key = this.redisKey(input);
    const result = await this.client.eval<unknown>(
      incrementScript,
      [key],
      [String(input.amount), String(input.ttlSeconds)],
    );
    const [amount, remainingTtlSeconds] = readBufferResult(result);
    return {
      ...normalizeKey(input),
      amount,
      remainingTtlSeconds,
    };
  }

  async get(
    input: UsageAggregationBufferKey,
  ): Promise<UsageAggregationBufferRecord | undefined> {
    validateKey(input);
    const result = await this.client.eval<unknown>(
      readScript,
      [this.redisKey(input)],
      [],
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error("Redis usage buffer response is invalid");
    }
    if ((result[0] === false || result[0] === null) && Number(result[1]) === -2) {
      return undefined;
    }
    const [amount, remainingTtlSeconds] = readBufferResult(result);
    return {
      ...normalizeKey(input),
      amount,
      remainingTtlSeconds,
    };
  }

  async clear(input: UsageAggregationBufferKey): Promise<boolean> {
    validateKey(input);
    return this.client.del(this.redisKey(input));
  }

  private redisKey(input: UsageAggregationBufferKey): string {
    const normalized = normalizeKey(input);
    const dimensions = Object.entries(normalized.dimensions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${encodeKeyPart(name)}=${encodeKeyPart(value)}`)
      .join("&");
    return `${this.keyPrefix}${encodeKeyPart(normalized.scope)}:${encodeKeyPart(normalized.metric)}:${normalized.windowStart}:${dimensions || "none"}`;
  }
}

function validateIncrement(input: UsageAggregationBufferIncrement): void {
  validateKey(input);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Usage buffer amount must be a positive finite number");
  }
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 1 || input.ttlSeconds > 86400) {
    throw new Error("Usage buffer TTL must be between 1 and 86400 seconds");
  }
}

function validateKey(input: UsageAggregationBufferKey): void {
  validateText(input.scope, "Usage buffer scope", 512);
  validateText(input.metric, "Usage buffer metric", 256);
  if (!Number.isInteger(input.windowStart) || input.windowStart < 0) {
    throw new Error("Usage buffer windowStart must be a non-negative epoch-second integer");
  }
  const dimensions = input.dimensions ?? {};
  const entries = Object.entries(dimensions);
  if (entries.length > 32) {
    throw new Error("Usage buffer dimensions cannot contain more than 32 entries");
  }
  for (const [name, value] of entries) {
    validateText(name, "Usage buffer dimension name", 128);
    validateText(value, "Usage buffer dimension value", 256);
  }
}

function normalizeKey(input: UsageAggregationBufferKey): UsageAggregationBufferKey & {
  readonly dimensions: Readonly<Record<string, string>>;
} {
  return {
    scope: input.scope,
    metric: input.metric,
    windowStart: input.windowStart,
    dimensions: { ...(input.dimensions ?? {}) },
  };
}

function validateText(value: string, field: string, maxLength: number): void {
  if (value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${field} must contain between 1 and ${maxLength} characters`);
  }
}

function readBufferResult(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Redis usage buffer response is invalid");
  }
  const amount = Number(value[0]);
  const remainingTtlSeconds = Number(value[1]);
  if (!Number.isFinite(amount) || !Number.isInteger(remainingTtlSeconds) || remainingTtlSeconds < 0) {
    throw new Error("Redis usage buffer response contains invalid values");
  }
  return [amount, remainingTtlSeconds];
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value);
}
