import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

import { Pool, type PoolClient } from 'pg';
import { logger } from "@mavibase/database/utils/logger";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const STATEMENT_TIMEOUT = Number.parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'); // 30 seconds default
const SLOW_QUERY_THRESHOLD_MS = Number.parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000');

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
 */
function persistSlowQuery(sql: string, duration: number): void {
  // Skip logging our own INSERT into slow_query_logs to prevent recursion
  if (sql.includes('slow_query_logs')) return;

  const operation = sql.trim().split(/\s+/)[0]?.toUpperCase() || 'UNKNOWN';

  rawPool.query(
    `INSERT INTO slow_query_logs (query_sql, duration_ms, threshold_ms, operation)
     VALUES ($1, $2, $3, $4)`,
    [sql.substring(0, 2000), duration, SLOW_QUERY_THRESHOLD_MS, operation]
  ).catch(() => { /* ignore persistence errors */ });
}

/**
 * Wrap a PoolClient so every query() call is timed for slow query detection.
 */
function wrapClient(client: PoolClient): PoolClient {
  const originalQuery = client.query.bind(client);

  // Override the query method with slow query detection
  (client as any).query = async (...args: any[]) => {
    const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    const start = Date.now();
    try {
      const result = await (originalQuery as any)(...args);
      const duration = Date.now() - start;
      if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
        logger.warn('Slow query detected (client)', { duration, query: text?.substring(0, 200) });
        persistSlowQuery(text, duration);
      }
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
        logger.warn('Slow query detected (client, errored)', { duration, query: text?.substring(0, 200) });
        persistSlowQuery(text, duration);
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
  const start = Date.now();
  try {
    const result = await (originalPoolQuery as any)(...args);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
      logger.warn('Slow query detected (pool)', { duration, query: text?.substring(0, 200) });
      persistSlowQuery(text, duration);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS && text) {
      logger.warn('Slow query detected (pool, errored)', { duration, query: text?.substring(0, 200) });
      persistSlowQuery(text, duration);
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
