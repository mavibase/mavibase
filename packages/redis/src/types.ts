export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options: { readonly ttlSeconds: number },
  ): Promise<boolean>;
  del(key: string): Promise<boolean>;
  publish(channel: string, message: string): Promise<void>;
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
