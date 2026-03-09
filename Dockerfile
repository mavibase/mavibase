# ============================================
# Mavibase Dockerfile - Multi-stage Build
# Optimized for size (~600MB-1GB final image)
# ============================================

# ---- Stage 1: Builder ----
FROM node:20-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Copy all config files needed for build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY .npmrc* ./

# Copy package.json for each workspace
COPY apps/server/package.json ./apps/server/
COPY apps/console/package.json ./apps/console/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/api/package.json ./packages/api/
COPY packages/platform/package.json ./packages/platform/

# Install all dependencies (need dev deps for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations
COPY scripts ./scripts

# Build everything
RUN pnpm build

# ---- Stage 2: Runtime (Clean Production Image) ----
FROM node:20-slim AS runtime
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client redis-tools && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@9

# Create non-root user
RUN addgroup --system --gid 1001 mavibase && \
    adduser --system --uid 1001 mavibase

# Copy node_modules from builder (pnpm hoists deps to root, packages don't have their own node_modules)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/console/node_modules ./apps/console/node_modules

# Copy native module dependencies needed by server (argon2)
# argon2 has native bindings that must exist at runtime
COPY --from=builder /app/node_modules/argon2 ./node_modules/argon2

# Copy package files (needed for runtime)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/console/package.json ./apps/console/
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/platform/package.json ./packages/platform/

# Copy ONLY built files from builder (not source code)
# Copy Next.js standalone build (includes server.js and all dependencies)
COPY --from=builder --chown=mavibase:mavibase /app/apps/console/.next/standalone ./
COPY --from=builder --chown=mavibase:mavibase /app/apps/console/.next/static ./apps/console/.next/static
COPY --from=builder --chown=mavibase:mavibase /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/platform/dist ./packages/platform/dist
COPY --from=builder --chown=mavibase:mavibase /app/migrations ./migrations
COPY --from=builder --chown=mavibase:mavibase /app/scripts/dist ./scripts

# Copy entrypoint from infra/docker directory
COPY --chown=mavibase:mavibase infra/docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER mavibase

# Expose ports
EXPOSE 5000 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
