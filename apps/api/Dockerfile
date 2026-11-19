# Multi-stage production Dockerfile for @luggage-storage/api
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app

# Copy root configuration and dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/contracts/ packages/contracts/
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/api/ apps/api/

# Build contracts first, then build API
RUN pnpm --filter @luggage-storage/contracts build
RUN pnpm --filter @luggage-storage/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

# Copy package manifests and prune for production
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy compiled artifacts from builder
COPY --from=builder /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/src/infrastructure/database/migrations /app/apps/api/dist/infrastructure/database/migrations

USER apiuser

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]

