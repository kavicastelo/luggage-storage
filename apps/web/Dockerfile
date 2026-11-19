# Multi-stage production Dockerfile for @luggage-storage/web
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
COPY apps/web/package.json apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/contracts/ packages/contracts/
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/web/ apps/web/

# Build contracts first, then build web SPA
RUN pnpm --filter @luggage-storage/contracts build
RUN pnpm --filter @luggage-storage/web build

FROM nginx:1.27-alpine AS runner

# Copy custom Nginx SPA configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

