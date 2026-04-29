#!/usr/bin/env bash
# POSIX equivalent of microservice_stress.ps1.
# Runs the binary N times with limited concurrency, captures wall ms + peak RSS
# from /usr/bin/time (GNU coreutils).

set -euo pipefail

ITER=${ITER:-50}
CONC=${CONC:-4}
BIN=${BIN:-}
REPORT=${REPORT:-}

if [[ -z "$BIN" ]]; then
  for c in \
    "$(dirname "$0")/../../../Codebase/Microservice/build/NeoTerritory" \
    "$(dirname "$0")/../../../Codebase/Microservice/build/NeoTerritory.exe"; do
    [[ -x "$c" ]] && BIN="$c" && break
  done
fi
[[ -z "$BIN" || ! -x "$BIN" ]] && { echo "binary not found, set BIN=" >&2; exit 2; }

TIMECMD=""
if command -v /usr/bin/time >/dev/null 2>&1; then
  TIMECMD="/usr/bin/time -f %e\t%M"
else
  echo "WARN: /usr/bin/time not available; peak RSS won't be captured." >&2
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

run_one() {
  local i=$1
  local out="$TMP/$i.txt"
  local t0 t1
  t0=$(date +%s%N)
  if [[ -n "$TIMECMD" ]]; then
    $TIMECMD "$BIN" >/dev/null 2>"$out" || true
  else
    "$BIN" >/dev/null 2>&1 || true
  fi
  t1=$(date +%s%N)
  local ms=$(( (t1 - t0) / 1000000 ))
  local kb=0
  if [[ -s "$out" ]]; then
    kb=$(awk -F'\t' '{print $2}' "$out" | tail -n1)
  fi
  echo "$ms $kb"
}

> "$TMP/samples.txt"
running=0
for ((i=0; i<ITER; i++)); do
  ( run_one "$i" >> "$TMP/samples.txt" ) &
  running=$((running+1))
  if (( running >= CONC )); then
    wait -n
    running=$((running-1))
  fi
done
wait

sort -n "$TMP/samples.txt" -o "$TMP/samples.sorted"
n=$(wc -l < "$TMP/samples.sorted")
pct() { awk -v p="$1" -v n="$n" 'NR==int(p/100*n)+1{print $0; exit}' "$TMP/samples.sorted"; }

echo "{"
echo "  \"binary\": \"$BIN\","
echo "  \"iterations\": $ITER,"
echo "  \"concurrency\": $CONC,"
echo "  \"wall_ms_p50\": $(pct 50 | awk '{print $1}'),"
echo "  \"wall_ms_p95\": $(pct 95 | awk '{print $1}'),"
echo "  \"wall_ms_p99\": $(pct 99 | awk '{print $1}'),"
echo "  \"peak_rss_kb_p95\": $(pct 95 | awk '{print $2}')"
echo "}"
