FROM node:22.21.1-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @codeguard/api... build
FROM node:22.21.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S codeguard && adduser -S codeguard -G codeguard
COPY --from=build --chown=codeguard:codeguard /workspace/node_modules ./node_modules
COPY --from=build --chown=codeguard:codeguard /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=codeguard:codeguard /workspace/packages ./packages
COPY --from=build --chown=codeguard:codeguard /workspace/package.json ./package.json
USER codeguard
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
