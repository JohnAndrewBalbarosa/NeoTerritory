# NeoTerritory per-tester sandbox image.
#
# A minimal, network-less Alpine container with g++ and basic tools, used
# by services/podManager.ts as the per-online-user sandbox where user
# C++ code compiles and runs. Container lifetime is governed by the
# manager (default 10 minutes, sliding TTL on heartbeat).
#
# Build:
#   docker build -f docker/cpp-pod.Dockerfile -t neoterritory/cpp-pod:latest .
#
# Run is handled by the backend; do not start this manually.

FROM alpine:3.20

# build-base bundles g++, libstdc++-dev, make. coreutils gives us a sane
# `sleep` for the keep-alive command.
RUN apk add --no-cache build-base coreutils

# Read-only root + writable tmpfs at /work (mounted by the runner via
# `--tmpfs /work:rw,size=16m,mode=1777`). Pre-create /work so a non-root
# entrypoint can chdir into it cleanly.
RUN mkdir -p /work && chmod 1777 /work
WORKDIR /work

# Drop privileges. Compilation and binary execution both run as `nobody`
# inside the network-less container — the strongest available isolation
# without wiring seccomp profiles per-host.
USER nobody

# Default command is a long sleep; the runner replaces it via `docker run
# ... sleep <ttl>`. Kept here so accidental `docker run` doesn't exec a
# shell that lingers indefinitely.
CMD ["sleep", "600"]
