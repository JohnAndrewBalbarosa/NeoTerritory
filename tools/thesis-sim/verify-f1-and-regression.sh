#!/usr/bin/env bash
# Fetch /api/admin/stats/{f1-metrics,complexity-data} and pretty-print.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/.env.deploy"
BASE="http://${AWS_HOST:-122.248.192.49}"

JWT=$(curl -fsS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo "== /api/admin/stats/f1-metrics =="
curl -fsS -H "Authorization: Bearer $JWT" "$BASE/api/admin/stats/f1-metrics" \
  | python -m json.tool | head -80

echo
echo "== /api/admin/stats/complexity-data (regressions only) =="
curl -fsS -H "Authorization: Bearer $JWT" "$BASE/api/admin/stats/complexity-data" \
  | python -c "
import sys, json
d = json.load(sys.stdin)
print('points:', len(d.get('points', [])))
for k in ['regression', 'regressionByItems', 'regressionSpaceByTokens']:
    r = d.get(k)
    if r:
        print(f'{k}: slope={r[\"slope\"]} intercept={r[\"intercept\"]} R2={r[\"r2\"]} n={r[\"n\"]}  -- {r.get(\"interpretation\",\"\")}')"
