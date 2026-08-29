# Redis Coordination Boundary

Task 0.6.2 and Task 0.6.3 add bounded Redis coordination primitives. Redis remains ephemeral infrastructure and is not the source of truth for platform entities, durable audit, migration history, or billable usage.

## Rate limits

`RedisRateLimiter` uses a namespaced fixed-window counter and a Redis Lua script so increment and first-write expiry are atomic. The result includes the decision, count, remaining allowance, and retry delay. Policies and subjects are validated before key construction.

## Idempotency

`RedisIdempotencyStore` keeps short-lived hot state for retryable operations. Claims use Redis `SET` with an absent-only condition. The record includes scope, key, request fingerprint, state, result reference, and expiry. Durable operation state remains outside Redis, and callers must handle a missing or expired hot record by consulting their durable owner.

## Distributed locks

`RedisDistributedLock` uses an absent-only set with a bounded TTL. Release compares the ownership token inside Redis before deleting, preventing one worker from releasing another worker’s lock. Locks are coordination hints; correctness must still come from durable state and idempotent operations.

## Distributed cache

`RedisDistributedCache` namespaces keys, requires bounded TTLs, validates cached values on read, and removes malformed values. Cached data is derived data and may be rebuilt after Redis loss.

The concrete Redis client, Lua execution adapter, eviction policy, failure metrics, and distributed integration tests remain deployment/runtime work.

## Usage aggregation buffers

`RedisUsageAggregationBuffer` atomically adds positive measurements to a namespaced metric/window/dimensions key and applies expiry on the first write. It supports reading the current aggregate and clearing it after a durable usage owner has persisted the value. Buffer keys use epoch-second windows and a maximum one-day TTL so repeated writes cannot keep a buffer alive indefinitely.

The buffer is a best-effort short-window optimization. Redis loss, eviction, expiry, or an acknowledged clear can lose an aggregate unless the durable usage owner has already recorded it. Later usage accounting must provide the durable measurement identity, rollup, retry, and reconciliation behavior; this package does not implement those services.
