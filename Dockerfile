# ============================================
# Mavibase Dockerfile
# Multi-stage build for smaller image size
# ============================================

# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/console/package.json ./apps/console/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/api/package.json ./packages/api/
COPY packages/platform/package.json ./packages/platform/

# Install production dependencies only
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations
COPY scripts ./scripts

# ---- Stage 2: Production ----
FROM node:20-alpine AS runner
WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache postgresql-client redis

# Create non-root user
RUN addgroup --system --gid 1001 mavibase && \
    adduser --system --uid 1001 mavibase

# Copy only what we need from builder
COPY --from=builder --chown=mavibase:mavibase /app/node_modules ./node_modules
COPY --from=builder --chown=mavibase:mavibase /app/apps ./apps
COPY --from=builder --chown=mavibase:mavibase /app/packages ./packages
COPY --from=builder --chown=mavibase:mavibase /app/migrations ./migrations
COPY --from=builder --chown=mavibase:mavibase /app/scripts ./scripts
COPY --from=builder --chown=mavibase:mavibase /app/package.json ./package.json

# Copy entrypoint
COPY --chown=mavibase:mavibase docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER mavibase

# Expose ports
EXPOSE 5000 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
