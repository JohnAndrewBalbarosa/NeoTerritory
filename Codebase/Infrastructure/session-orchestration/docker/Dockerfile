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
# Stage 2: build the frontend (Vite → static dist/)
# Done in its own stage so the runtime image doesn't carry vite/devDeps.
# =========================================================================
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /fe
COPY Codebase/Frontend/package.json Codebase/Frontend/package-lock.json ./
RUN npm ci
COPY Codebase/Frontend ./
RUN npm run build

# =========================================================================
# Stage 3: Node.js runtime + backend + frontend + microservice binary
# =========================================================================
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001

# better-sqlite3 ships prebuilt binaries via prebuild-install for linux-x64
# and linux-arm64; if the prebuild fetch fails, npm falls back to
# node-gyp compile, which requires python3 + make + g++. Install them so
# `npm ci` succeeds on any Lightsail / EC2 architecture.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend deps (include devDeps so tsc is available for the build step)
COPY Codebase/Backend/package.json Codebase/Backend/package-lock.json ./Codebase/Backend/
RUN cd Codebase/Backend && npm ci

# Application code + TypeScript compile
COPY Codebase/Backend  ./Codebase/Backend
RUN cd Codebase/Backend && npm run build && npm prune --production

# Frontend: copy SOURCE (so the served path keeps non-bundled assets like
# /public, /admin.html, /scraper.html), then overlay the built dist/ on top
# so index.html points at the hashed bundle. Express static-serves
# Codebase/Frontend, so this layout matches existing behavior.
COPY Codebase/Frontend ./Codebase/Frontend
COPY --from=frontend-builder /fe/dist/ ./Codebase/Frontend/

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
CMD ["node", "dist/server.js"]
