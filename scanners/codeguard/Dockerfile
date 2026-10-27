FROM node:22.21.1-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY scanners/codeguard/package.json scanners/codeguard/package.json
RUN --mount=type=cache,id=codeguard-pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --trust-lockfile
COPY scanners/codeguard/tsconfig.json scanners/codeguard/tsconfig.json
COPY scanners/codeguard/src scanners/codeguard/src
RUN ./node_modules/.bin/tsc -p scanners/codeguard/tsconfig.json

FROM semgrep/semgrep:1.179.0
RUN apk add --no-cache nodejs git && addgroup -S codeguard && adduser -S codeguard -G codeguard
COPY --from=build --chown=codeguard:codeguard /workspace/scanners/codeguard/dist /opt/codeguard
ENV HOME=/tmp
WORKDIR /workspace
USER codeguard
ENTRYPOINT ["node", "/opt/codeguard/main.js"]
