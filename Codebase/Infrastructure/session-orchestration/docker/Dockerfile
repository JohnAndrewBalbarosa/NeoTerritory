# Multi-stage build: stage 1 compiles the C++ microservice,
# stage 2 produces a Node.js runtime image that bakes in the binary,
# the pattern catalog, the Express backend, and the static Frontend.
# Final container exposes the backend on :3001 and spawns the C++
# microservice as a subprocess per /api/analyze request (D20).

# =========================================================================
# Stage 1: build the C++ microservice
# =========================================================================
FROM debian:bookworm-slim AS microservice-builder

ENV DEBIAN_FRONTEND=noninteractive

# Match the runtime base (node:20-bookworm-slim) so glibc versions agree —
# otherwise the binary fails at startup with `GLIBC_2.38 not found`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY Codebase/Microservice /src

RUN mkdir -p /build \
    && cd /build \
    && cmake /src \
    && make -j"$(nproc)"

# =========================================================================
# Stage 2: Node.js runtime + backend + frontend + microservice binary
# =========================================================================
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001

# better-sqlite3 needs a libstdc++ runtime (provided by bookworm-slim already)
# and the spawned C++ binary was statically linked at compile time.

WORKDIR /app

# Backend deps first — separate layer for cache reuse
COPY Codebase/Backend/package.json Codebase/Backend/package-lock.json ./Codebase/Backend/
RUN cd Codebase/Backend && npm ci --omit=dev

# Application code
COPY Codebase/Backend  ./Codebase/Backend
COPY Codebase/Frontend ./Codebase/Frontend

# Bake the microservice artifacts into the image at the canonical path
# the backend expects (Codebase/Microservice/build/NeoTerritory and
# Codebase/Microservice/pattern_catalog).
COPY --from=microservice-builder /build/NeoTerritory          ./Codebase/Microservice/build/NeoTerritory
COPY Codebase/Microservice/pattern_catalog                    ./Codebase/Microservice/pattern_catalog
COPY Codebase/Microservice/samples                            ./Codebase/Microservice/samples

# Default env: backend resolves the binary + catalog from these.
ENV NEOTERRITORY_BIN=/app/Codebase/Microservice/build/NeoTerritory
ENV NEOTERRITORY_CATALOG=/app/Codebase/Microservice/pattern_catalog

EXPOSE 3001

WORKDIR /app/Codebase/Backend
CMD ["node", "server.js"]
