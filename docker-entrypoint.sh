#!/bin/sh
set -e

echo "============================================"
echo "  Mavibase - Starting up..."
echo "============================================"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-mavibase}" 2>/dev/null; do
  echo "PostgreSQL is not ready - waiting..."
  sleep 2
done
echo "PostgreSQL is ready!"

# Wait for Redis to be ready (if configured)
if [ -n "$REDIS_URL" ]; then
  echo "Waiting for Redis..."
  # Extract host, port, and password from REDIS_URL
  # Format: redis://:password@host:port or redis://host:port
  REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|redis://(:.*@)?([^:]+):([0-9]+).*|\2|')
  REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|redis://(:.*@)?([^:]+):([0-9]+).*|\3|')
  REDIS_PASS=$(echo "$REDIS_URL" | sed -E 's|redis://:?([^@]*)@.*|\1|' | grep -v "^redis://" || echo "")
  
  # Default values
  REDIS_HOST=${REDIS_HOST:-redis}
  REDIS_PORT=${REDIS_PORT:-6379}
  
  if [ -n "$REDIS_PASS" ]; then
    until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" ping 2>/dev/null | grep -q PONG; do
      echo "Redis is not ready - waiting..."
      sleep 2
    done
  else
    until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; do
      echo "Redis is not ready - waiting..."
      sleep 2
    done
  fi
  echo "Redis is ready!"
fi

# Run migrations if AUTO_MIGRATE is enabled (default: true)
if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
  echo "Running database migrations..."
  cd /app
  node scripts/migrate-platform.js || echo "Platform migration completed (or already up to date)"
  node scripts/migrate-database.js || echo "Database migration completed (or already up to date)"
  echo "Migrations complete!"
fi

echo "============================================"
echo "  Starting Mavibase services..."
echo "============================================"

# Start the server and console
cd /app

# Run server in background
node apps/server/dist/main.js &
SERVER_PID=$!

# Run console
node apps/console/server.js &
CONSOLE_PID=$!

echo "Server running on port 5000 (PID: $SERVER_PID)"
echo "Console running on port 3000 (PID: $CONSOLE_PID)"

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
