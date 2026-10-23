FROM node:22.21.1-alpine AS base
RUN corepack enable
WORKDIR /workspace
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile
FROM deps AS build
COPY . .
RUN pnpm --filter @codeguard/web build
FROM node:22.21.1-alpine AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
RUN addgroup -S codeguard && adduser -S codeguard -G codeguard
COPY --from=build --chown=codeguard:codeguard /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=codeguard:codeguard /workspace/apps/web/.next/static ./apps/web/.next/static
USER codeguard
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
