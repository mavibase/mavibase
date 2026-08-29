# Redis Coordination Boundary

Task 0.6.2 adds bounded Redis coordination primitives. Redis remains ephemeral infrastructure and is not the source of truth for platform entities, durable audit, migration history, or billable usage.

## Rate limits

`RedisRateLimiter` uses a namespaced fixed-window counter and a Redis Lua script so increment and first-write expiry are atomic. The result includes the decision, count, remaining allowance, and retry delay. Policies and subjects are validated before key construction.

## Idempotency

`RedisIdempotencyStore` keeps short-lived hot state for retryable operations. Claims use Redis `SET` with an absent-only condition. The record includes scope, key, request fingerprint, state, result reference, and expiry. Durable operation state remains outside Redis, and callers must handle a missing or expired hot record by consulting their durable owner.

## Distributed locks

`RedisDistributedLock` uses an absent-only set with a bounded TTL. Release compares the ownership token inside Redis before deleting, preventing one worker from releasing another worker’s lock. Locks are coordination hints; correctness must still come from durable state and idempotent operations.

## Distributed cache

`RedisDistributedCache` namespaces keys, requires bounded TTLs, validates cached values on read, and removes malformed values. Cached data is derived data and may be rebuilt after Redis loss.

The concrete Redis client, Lua execution adapter, eviction policy, failure metrics, and distributed integration tests remain deployment/runtime work. Usage aggregation buffers belong to Task 0.6.3.
