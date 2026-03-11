import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

import { Pool, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from "@mavibase/database/utils/logger";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const STATEMENT_TIMEOUT = Number.parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'); // 30 seconds default
const SLOW_QUERY_THRESHOLD_MS = Number.parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '500'); // 500ms default

/**
 * Request context for slow query tracking.
 * Only track slow queries for external API requests (api_key type).
 */
export interface RequestContext {
  identityType?: 'user' | 'api_key' | 'service' | 'anonymous';
  databaseId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with request context for slow query tracking.
 * Only external API requests (identityType: 'api_key') will have their slow queries logged.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

/**
 * Check if slow query tracking should be enabled for the current request.
 */
function shouldTrackSlowQueries(): boolean {
  const ctx = requestContext.getStore();
  // Track for external API requests (api_key or service), not console/user requests
  // 'user' = console session, 'anonymous' = unauthenticated
  return ctx?.identityType === 'api_key' || ctx?.identityType === 'service';
}

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: STATEMENT_TIMEOUT,
});

rawPool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err });
});

/**
 * Persist a slow query log to the database (fire-and-forget).
 * Uses rawPool directly to avoid infinite recursion.
 * Requires databaseId to ensure all rows are project-scoped.
 * Rows with no databaseId are intentionally dropped — unscoped slow
 * query rows would be accessible to all projects (security risk).
 */
async function persistSlowQuery(sql: string, duration: number, params?: any[], databaseId?: string): Promise<void> {
  // Skip if not an external API request
  if (!shouldTrackSlowQueries()) return;
  
  // Skip logging our own INSERT into slow_query_logs to prevent recursion
  if (sql.includes('slow_query_logs')) return;
  // Skip collection lookups to prevent recursion
  if (sql.includes('SELECT database_id FROM collections')) return;

  let resolvedDbId = databaseId;

  // If no database_id, try to resolve via collection_id
  if (!resolvedDbId) {
    let collectionId = extractCollectionId(sql);
    
    if (!collectionId && params && params.length > 0) {
      collectionId = extractCollectionIdFromParams(sql, params);
    }
    
    if (collectionId) {
      resolvedDbId = await resolveCollectionToDatabase(collectionId);
    }
  }

  // Drop unscoped slow queries — never insert rows with NULL database_id
  if (!resolvedDbId) return;

  const operation = sql.trim().split(/\s+/)[0]?.toUpperCase() || 'UNKNOWN';

  rawPool.query(
    `INSERT INTO slow_query_logs (database_id, query_sql, duration_ms, threshold_ms, operation)
     VALUES ($1, $2, $3, $4, $5)`,
    [resolvedDbId, sql.substring(0, 2000), duration, SLOW_QUERY_THRESHOLD_MS, operation]
  ).catch(() => { /* ignore persistence errors */ });
}

/**
 * Extract database_id hint from a SQL statement.
 * Looks for UUID-shaped values next to common database-scoped column references.
 * This is best-effort — if not found, slow query is not persisted (by design).
 */
function extractDatabaseId(sql: string): string | undefined {
  // Match UUID pattern after database_id = '...'
  const dbMatch = sql.match(/database_id\s*=\s*'([0-9a-f-]{36})'/i);
  return dbMatch?.[1];
}

/**
 * Extract collection_id from a SQL statement for later database_id resolution.
 */
function extractCollectionId(sql: string): string | undefined {
  const match = sql.match(/collection_id\s*=\s*'([0-9a-f-]{36})'/i);
  if (match) return match[1];
  
  // Also check for VALUES ($1, $2, ...) patterns in INSERTs - look for collection_id column
  // This won't work for parameterized queries, but let's try to match inline UUIDs
  const valuesMatch = sql.match(/VALUES\s*\(\s*'[0-9a-f-]{36}'\s*,\s*'([0-9a-f-]{36})'/i);
  return valuesMatch?.[1];
}

/**
 * Extract collection_id from query parameters by analyzing the SQL column positions.
 * For INSERT statements, find the position of collection_id in the column list,
 * then extract the corresponding parameter value.
 */
function extractCollectionIdFromParams(sql: string, params: any[]): string | undefined {
  const upperSql = sql.toUpperCase();
  
  // Handle INSERT INTO ... (col1, col2, ...) VALUES ($1, $2, ...)
  if (upperSql.includes('INSERT INTO')) {
    // Extract column list between first ( and )
    const colMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(\s*([^)]+)\s*\)/i);
    if (colMatch) {
      const columns = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      const collectionIdIndex = columns.indexOf('collection_id');
      if (collectionIdIndex !== -1 && params[collectionIdIndex]) {
        const value = params[collectionIdIndex];
        // Validate it looks like a UUID
        if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) {
          return value;
        }
      }
    }
  }
  
  // Handle WHERE collection_id = $N
  const whereMatch = sql.match(/collection_id\s*=\s*\$(\d+)/i);
  if (whereMatch) {
    const paramIndex = parseInt(whereMatch[1], 10) - 1; // $1 = params[0]
    if (params[paramIndex]) {
      const value = params[paramIndex];
      if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) {
        return value;
      }
    }
  }
  
  return undefined;
}

// Cache collection_id -> database_id mappings to avoid repeated lookups
const collectionToDatabaseCache = new Map<string, string>();
const CACHE_TTL_MS = 60000; // 1 minute
const cacheTimestamps = new Map<string, number>();

/**
 * Resolve collection_id to database_id using cache or database lookup.
 * Returns undefined if lookup fails (fire-and-forget, non-blocking).
 */
async function resolveCollectionToDatabase(collectionId: string): Promise<string | undefined> {
  const now = Date.now();
  const cachedTs = cacheTimestamps.get(collectionId);
  
  if (cachedTs && (now - cachedTs) < CACHE_TTL_MS) {
    return collectionToDatabaseCache.get(collectionId);
  }
  
  try {
    const result = await rawPool.query(
      'SELECT database_id FROM collections WHERE id = $1 LIMIT 1',
      [collectionId]
    );
    if (result.rows.length > 0) {
      const dbId = result.rows[0].database_id;
      collectionToDatabaseCache.set(collectionId, dbId);
      cacheTimestamps.set(collectionId, now);
      return dbId;
    }
  } catch {
    // Ignore lookup errors
  }
  return undefined;
}

/**
 * Wrap a PoolClient so every query() call is timed for slow query detection.
 * databaseId is passed through to scope slow_query_logs rows.
 */
function wrapClient(client: PoolClient, databaseId?: string): PoolClient {
  const originalQuery = client.query.bind(client);

  // Override the query method with slow query detection
  (client as any).query = async (...args: any[]) => {
    const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    const params = typeof args[0] === 'string' ? args[1] : args[0]?.values;
    const start = Date.now();
    try {
      const result = await (originalQuery as any)(...args);
      const duration = Date.now() - start;
      if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
        const dbId = databaseId || extractDatabaseId(text);
        logger.warn('Slow query detected (client)', { duration, query: text?.substring(0, 200) });
        persistSlowQuery(text, duration, params, dbId);
      }
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
        const dbId = databaseId || extractDatabaseId(text);
        logger.warn('Slow query detected (client, errored)', { duration, query: text?.substring(0, 200) });
        persistSlowQuery(text, duration, params, dbId);
      }
      throw error;
    }
  };

  return client;
}

/**
 * Instrumented pool that intercepts ALL queries for slow query logging.
 * This works regardless of whether code calls pool.query() or client.query().
 */
const originalConnect = rawPool.connect.bind(rawPool);
const originalPoolQuery = rawPool.query.bind(rawPool);

// Intercept pool.connect() to wrap each client
(rawPool as any).connect = async (...args: any[]) => {
  // Support both callback and promise styles
  if (args.length > 0 && typeof args[0] === 'function') {
    return (originalConnect as any)((err: any, client: any, release: any) => {
      if (client) client = wrapClient(client);
      args[0](err, client, release);
    });
  }
  const client = await (originalConnect as any)();
  return wrapClient(client);
};

// Intercept pool.query() for direct pool queries
(rawPool as any).query = async (...args: any[]) => {
  const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
  const params = typeof args[0] === 'string' ? args[1] : args[0]?.values;
  const start = Date.now();
  try {
    const result = await (originalPoolQuery as any)(...args);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
      const dbId = extractDatabaseId(text);
      logger.warn('Slow query detected (pool)', { duration, query: text?.substring(0, 200) });
      persistSlowQuery(text, duration, params, dbId);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
      const dbId = extractDatabaseId(text);
      logger.warn('Slow query detected (pool, errored)', { duration, query: text?.substring(0, 200) });
      persistSlowQuery(text, duration, params, dbId);
    }
    throw error;
  }
};

// Export the instrumented pool as `pool`
export const pool = rawPool;

export const query = async (text: string, params?: any[]) => {
  // pool.query is already instrumented above, just delegate
  return pool.query(text, params);
};
