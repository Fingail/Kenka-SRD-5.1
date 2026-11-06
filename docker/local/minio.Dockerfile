FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS build
ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z
RUN git clone --depth 1 --branch ${MINIO_RELEASE} https://github.com/minio/minio.git /src
WORKDIR /src
RUN CGO_ENABLED=0 GOMAXPROCS=2 go build -p 2 -trimpath -o /out/minio .
FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/licenses/minio/LICENSE
LABEL org.opencontainers.image.source="https://github.com/minio/minio"
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"
LABEL org.opencontainers.image.version="RELEASE.2025-10-15T17-29-55Z"
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
