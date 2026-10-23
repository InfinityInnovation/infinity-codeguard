FROM golang:1.24.12-alpine AS build

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ENV CGO_ENABLED=0 GOBIN=/out

RUN go install -trimpath -ldflags="-s -w" github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.22.2 AS runtime

RUN apk add --no-cache ca-certificates curl \
    && addgroup -S -g 10001 minio \
    && adduser -S -D -H -u 10001 -G minio minio \
    && mkdir -p /data \
    && chown minio:minio /data

COPY --from=build --chown=minio:minio /out/minio /usr/local/bin/minio

USER minio
VOLUME ["/data"]
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]
