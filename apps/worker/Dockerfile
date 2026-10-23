FROM node:22.21.1-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @codeguard/worker... build
FROM node:22.21.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S codeguard && adduser -S codeguard -G codeguard
COPY --from=build --chown=codeguard:codeguard /workspace/node_modules ./node_modules
COPY --from=build --chown=codeguard:codeguard /workspace/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=codeguard:codeguard /workspace/package.json ./package.json
USER codeguard
CMD ["node", "apps/worker/dist/main.js"]
