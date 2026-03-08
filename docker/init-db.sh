#!/bin/bash
set -e

# Create the second database (mavibase_db)
# The first database (mavibase_platform) is created automatically via POSTGRES_DB
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE mavibase_db;
    GRANT ALL PRIVILEGES ON DATABASE mavibase_db TO $POSTGRES_USER;
EOSQL

echo "Database initialization complete!"
