# ============================================
# Mavibase Dockerfile
# Multi-stage build - mirrors local workflow
# ============================================

# ---- Stage 1: Builder (mirrors: pnpm install) ----
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

# Install ALL dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations
COPY scripts ./scripts

# Build everything (packages + console)
RUN pnpm build

# Create public folder if it doesn't exist (Next.js needs it)
RUN mkdir -p /app/apps/console/public

# ---- Stage 2: Production (only dist folders) ----
FROM node:20-alpine AS runner
WORKDIR /app

# Install only runtime tools
RUN apk add --no-cache postgresql-client redis

# Create non-root user
RUN addgroup --system --gid 1001 mavibase && \
    adduser --system --uid 1001 mavibase

# Copy ONLY built files from builder (no node_modules, no source code)
COPY --from=builder --chown=mavibase:mavibase /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=mavibase:mavibase /app/apps/console/.next ./apps/console/.next
COPY --from=builder --chown=mavibase:mavibase /app/apps/console/public ./apps/console/public
COPY --from=builder --chown=mavibase:mavibase /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=mavibase:mavibase /app/packages/platform/dist ./packages/platform/dist
COPY --from=builder --chown=mavibase:mavibase /app/migrations ./migrations
COPY --from=builder --chown=mavibase:mavibase /app/scripts ./scripts
COPY --from=builder --chown=mavibase:mavibase /app/node_modules ./node_modules
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
