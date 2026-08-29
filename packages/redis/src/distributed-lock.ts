import type { RedisScriptClient } from "./types.js";

const releaseLockScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export class RedisDistributedLock {
  constructor(
    private readonly client: RedisScriptClient,
    private readonly keyPrefix: string = "lock:",
  ) {}

  async acquire(
    name: string,
    token: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    validateText(name, "lock name");
    validateText(token, "lock token");
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
      throw new Error("Lock TTL must be between 1 and 300 seconds");
    }
    return this.client.set(
      `${this.keyPrefix}${encodeURIComponent(name)}`,
      token,
      { ttlSeconds, onlyIfAbsent: true },
    );
  }

  async release(name: string, token: string): Promise<boolean> {
    validateText(name, "lock name");
    validateText(token, "lock token");
    const result = await this.client.eval<unknown>(
      releaseLockScript,
      [`${this.keyPrefix}${encodeURIComponent(name)}`],
      [token],
    );
    return Number(result) === 1;
  }
}

function validateText(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 512) {
    throw new Error(`${field} must contain between 1 and 512 characters`);
  }
}
