#!/usr/bin/env bash
# Coloured output helpers + a tiny tool-existence probe.

step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m    [ok] %s\033[0m\n' "$*"; }
warn() { printf '\033[33m    [!!] %s\033[0m\n' "$*"; }
err()  { printf '\033[31m    [xx] %s\033[0m\n' "$*" >&2; }
has()  { command -v "$1" >/dev/null 2>&1; }
