FROM node:22.21.1-alpine AS build
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
RUN --mount=type=cache,id=codeguard-pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --trust-lockfile
COPY . .
RUN ./node_modules/.bin/tsc -p packages/config/tsconfig.json \
    && ./packages/database/node_modules/.bin/prisma generate --schema packages/database/prisma/schema.prisma \
    && ./node_modules/.bin/tsc -p packages/database/tsconfig.json \
    && ./node_modules/.bin/tsc -p apps/worker/tsconfig.json
FROM semgrep/semgrep:1.179.0 AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache nodejs && addgroup -S codeguard && adduser -S codeguard -G codeguard
COPY --from=build --chown=codeguard:codeguard /workspace/node_modules ./node_modules
COPY --from=build --chown=codeguard:codeguard /workspace/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=codeguard:codeguard /workspace/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=codeguard:codeguard /workspace/packages ./packages
COPY --from=build --chown=codeguard:codeguard /workspace/package.json ./package.json
USER codeguard
CMD ["node", "apps/worker/dist/main.js"]
