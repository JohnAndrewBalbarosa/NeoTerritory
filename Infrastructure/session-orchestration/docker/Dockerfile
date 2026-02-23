FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . /app

RUN mkdir -p /build \
    && cd /build \
    && cmake /app \
    && make -j"$(nproc)"

CMD ["./build/NeoTerritory"]
