import type {
  LocalSessionCache,
  RedisClient,
  RedisSessionState,
  RedisSessionStoreOptions,
  SessionInvalidationMessage,
} from "./types.js";

const defaultKeyPrefix = "session:";
const defaultInvalidationChannel = "mavibase:session-invalidation";

export class RedisSessionStore {
  private readonly keyPrefix: string;
  private readonly invalidationChannel: string;
  private readonly now: () => number;

  constructor(
    private readonly client: RedisClient,
    options: RedisSessionStoreOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? defaultKeyPrefix;
    this.invalidationChannel = options.invalidationChannel ?? defaultInvalidationChannel;
    this.now = options.now ?? Date.now;
  }

  async save(session: RedisSessionState): Promise<void> {
    validateSession(session);
    const ttlSeconds = remainingTtlSeconds(session, this.now());
    if (ttlSeconds === 0) {
      throw new Error(`Cannot store an expired session: ${session.sessionId}`);
    }
    const stored = await this.client.set(
      this.key(session.sessionId),
      JSON.stringify(session),
      { ttlSeconds },
    );
    if (!stored) {
      throw new Error(`Redis refused to store session: ${session.sessionId}`);
    }
  }

  async get(sessionId: string): Promise<RedisSessionState | undefined> {
    validateSessionId(sessionId);
    const value = await this.client.get(this.key(sessionId));
    if (value === null) {
      return undefined;
    }
    const session = parseSession(value);
    if (session.sessionId !== sessionId || remainingTtlSeconds(session, this.now()) === 0) {
      await this.client.del(this.key(sessionId));
      return undefined;
    }
    return session;
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    validateSessionId(sessionId);
    if (reason.trim().length === 0) {
      throw new Error("Session revocation reason is required");
    }
    await this.client.del(this.key(sessionId));
    const message: SessionInvalidationMessage = {
      sessionId,
      reason,
      occurredAt: this.now(),
    };
    await this.client.publish(this.invalidationChannel, JSON.stringify(message));
  }

  key(sessionId: string): string {
    validateSessionId(sessionId);
    return `${this.keyPrefix}${sessionId}`;
  }

  channel(): string {
    return this.invalidationChannel;
  }
}

export function createLocalSessionCache(
  now: () => number = Date.now,
): LocalSessionCache {
  const sessions = new Map<string, RedisSessionState>();
  return {
    get(sessionId) {
      const session = sessions.get(sessionId);
      if (session === undefined || remainingTtlSeconds(session, now()) === 0) {
        sessions.delete(sessionId);
        return undefined;
      }
      return session;
    },
    set(session) {
      validateSession(session);
      sessions.set(session.sessionId, session);
    },
    invalidate(sessionId) {
      validateSessionId(sessionId);
      sessions.delete(sessionId);
    },
    invalidateFromMessage(message) {
      try {
        const parsed = JSON.parse(message) as unknown;
        if (!isInvalidationMessage(parsed)) {
          return false;
        }
        sessions.delete(parsed.sessionId);
        return true;
      } catch {
        return false;
      }
    },
  };
}

function validateSession(session: RedisSessionState): void {
  validateSessionId(session.sessionId);
  requireText(session.accountId, "accountId");
  requireText(session.authLevel, "authLevel");
  if (![session.createdAt, session.lastSeenAt, session.idleExpiresAt, session.absoluteExpiresAt].every(Number.isFinite)) {
    throw new Error(`Invalid timestamps for session: ${session.sessionId}`);
  }
  if (session.createdAt > session.lastSeenAt || session.lastSeenAt > session.absoluteExpiresAt || session.idleExpiresAt <= session.lastSeenAt) {
    throw new Error(`Invalid expiry order for session: ${session.sessionId}`);
  }
  if (session.deviceId !== null) {
    requireText(session.deviceId, "deviceId");
  }
  if (session.ip !== null) {
    requireText(session.ip, "ip");
  }
  if (session.userAgent !== null) {
    requireText(session.userAgent, "userAgent");
  }
}

function validateSessionId(sessionId: string): void {
  if (!/^[a-zA-Z0-9._:-]{16,256}$/.test(sessionId)) {
    throw new Error("Invalid session ID");
  }
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Session ${field} is required`);
  }
}

function remainingTtlSeconds(session: RedisSessionState, now: number): number {
  const expiry = Math.min(session.idleExpiresAt, session.absoluteExpiresAt);
  return Math.max(0, Math.ceil((expiry - now) / 1000));
}

function parseSession(value: string): RedisSessionState {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isSessionState(parsed)) {
      throw new Error("invalid session payload");
    }
    validateSession(parsed);
    return parsed;
  } catch {
    throw new Error("Redis session payload is invalid");
  }
}

function isSessionState(value: unknown): value is RedisSessionState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.sessionId === "string"
    && typeof candidate.accountId === "string"
    && typeof candidate.createdAt === "number"
    && typeof candidate.lastSeenAt === "number"
    && typeof candidate.idleExpiresAt === "number"
    && typeof candidate.absoluteExpiresAt === "number"
    && typeof candidate.authLevel === "string"
    && (candidate.deviceId === null || typeof candidate.deviceId === "string")
    && (candidate.ip === null || typeof candidate.ip === "string")
    && (candidate.userAgent === null || typeof candidate.userAgent === "string");
}

function isInvalidationMessage(value: unknown): value is SessionInvalidationMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.sessionId === "string"
    && typeof candidate.reason === "string"
    && typeof candidate.occurredAt === "number";
}
