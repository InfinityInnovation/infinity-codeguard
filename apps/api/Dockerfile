FROM node:22.21.1-alpine AS build
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN --mount=type=cache,id=codeguard-pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --trust-lockfile
COPY . .
RUN ./node_modules/.bin/tsc -p packages/config/tsconfig.json \
    && ./node_modules/.bin/tsc -p packages/contracts/tsconfig.json \
    && ./node_modules/.bin/tsc -p packages/auth/tsconfig.json \
    && ./packages/database/node_modules/.bin/prisma generate --schema packages/database/prisma/schema.prisma \
    && ./node_modules/.bin/tsc -p packages/database/tsconfig.json \
    && cd apps/api \
    && ./node_modules/.bin/nest build
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
