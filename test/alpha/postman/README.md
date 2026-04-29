# Postman Alpha Suite

## Run

GUI:
1. Postman → Import → drop the three JSON files in this folder.
2. Pick env: `NeoTerritory Local` or `NeoTerritory Deploy`.
3. Collection Runner → Run NeoTerritory Alpha — Connection & SLA.

CLI (recommended for CI):
```bash
npx -y newman run test/alpha/postman/NeoTerritory_Alpha.postman_collection.json \
  -e test/alpha/postman/NeoTerritory_Local.postman_environment.json \
  --reporters cli,json,junit \
  --reporter-json-export reports/newman.json \
  --reporter-junit-export reports/newman-junit.xml
```

Newman exits non-zero on any test fail, so CI gates "out of the box."

## What Gets Tested

| Folder | Validates |
|---|---|
| 01 Connection | TCP/HTTP reachability, JSON contract, microservice binary + catalog discoverable, latency under env SLA |
| 02 Auth | Seed accounts visible, login issues JWT under SLA |
| 03 Analysis Pipeline | Sample fetch → analyze → save → fetch run; full happy path with SLA gates |
| 04 Negative / Contract | 401 on missing JWT, 400 on empty body — fast-fail paths still under SLA |

## Why Postman Latency ≠ Real p95

Postman measures wall-clock per request. A single request hitting the SLA does
not prove p95 — it proves the *median-ish* path. For a defensible p95/p99 we
also run `stress/backend_stress.js` (see top-level README). Postman is the
**connection / contract / "is the service alive and within budget"** gate;
the stress harness is the **statistical** gate.

This split mirrors the convention used by:
- Grafana k6 docs ("Smoke vs Load vs Stress vs Soak", k6.io/docs/test-types)
- Postman Learning Center, "API performance testing" (postman.com/api-platform/api-performance-testing)

## Threshold Sources (replicated from top-level README for auditability)

- **Google RAIL Performance Model** — Irish & Kearney (2015). Tap response
  budget 100 ms; load budget 1 s. Used for `/health`, `/api/health`, `/auth`.
- **Nielsen, J. (1993).** *Usability Engineering.* Morgan Kaufmann. The
  0.1 s / 1 s / 10 s human attention thresholds (originally Card, Robertson &
  Mackinlay, 1991, "The information visualizer, an information workspace,"
  *CHI '91*, pp. 181–186). Frames the analyze ceiling.
- **ITU-T G.1010 (2001).** *End-user multimedia QoS categories.* Interactive
  transactional: <2 s preferred, <4 s acceptable. Used for `/api/analyze`.
- **Apdex Alliance (2007).** *Apdex Technical Specification V1.1.*
  T = target latency; satisfied ≤ T, tolerating ≤ 4T. Used by stress/system
  scripts to roll up p-values into a 0–1 score.
- **Tene, G. (2015).** *How NOT to Measure Latency.* Strange Loop. Source for
  why we always emit p50/p95/p99 (not averages) and apply HDR-histogram-style
  reporting in `stress/backend_stress.js`.

## Updating SLAs
Single source of truth: `../system/thresholds.json`. Postman environments
duplicate the same numbers because Newman cannot read external JSON; if you
change `thresholds.json`, also bump the env files. The CI pipeline can be
extended to generate the env files from `thresholds.json` automatically.
