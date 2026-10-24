FROM node:22.21.1-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN --mount=type=cache,id=codeguard-pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @codeguard/api... build
FROM node:22.21.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S codeguard && adduser -S codeguard -G codeguard
COPY --from=build --chown=codeguard:codeguard /workspace/node_modules ./node_modules
COPY --from=build --chown=codeguard:codeguard /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=codeguard:codeguard /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=codeguard:codeguard /workspace/packages ./packages
COPY --from=build --chown=codeguard:codeguard /workspace/package.json ./package.json
USER codeguard
EXPOSE 4000
CMD ["node", "apps/api/dist/src/main.js"]
