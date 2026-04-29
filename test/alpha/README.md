# Alpha Test Suite — NeoTerritory

Quantitative, technical-grade testing assets for alpha. Hindi ito tungkol sa
algorithm accuracy. Ang focus dito ay **speed, latency, throughput, and memory**
ng (1) microservice [C++], (2) backend [Node.js/Express], at (3) end-to-end
system. Lahat ng numbers ay tinatakda laban sa published industry standards
para auditable / quantitative ang pass-fail.

```
test/alpha/
├── README.md                    # this file
├── postman/                     # Postman connection / SLA gates
│   ├── NeoTerritory_Alpha.postman_collection.json
│   ├── NeoTerritory_Local.postman_environment.json
│   ├── NeoTerritory_Deploy.postman_environment.json
│   └── README.md                # how to run + standards rationale
├── unit/
│   ├── backend/                 # node:test based unit tests
│   │   ├── package.json
│   │   ├── health.test.js
│   │   ├── analysis_helpers.test.js
│   │   └── auth_routes.test.js
│   └── microservice/            # CTest-compatible C++ unit tests
│       ├── CMakeLists.txt
│       ├── test_pipeline_smoke.cpp
│       └── test_pattern_dispatch.cpp
├── stress/
│   ├── backend_stress.js        # node load generator (concurrency + memory RSS)
│   ├── microservice_stress.ps1  # spawns N microservice runs, captures wall + peak WS
│   └── microservice_stress.sh   # POSIX equivalent
└── system/
    ├── system_speed.ps1         # full-stack p50/p95 timing
    └── thresholds.json          # single source of truth for SLA numbers
```

## Reference Standards (Quantitative Targets)

Lahat ng SLA na ginagamit dito ay nakatanim sa established research. Hindi ako
nag-iimbento ng numero — naka-attach ang citation sa bawat threshold.

| Standard | Source | Used For |
|---|---|---|
| RAIL model: <100 ms tap response, <1 s page-ready | Google Web Fundamentals (Irish & Kearney, 2015) | Health + auth endpoints |
| 0.1 s / 1 s / 10 s human attention thresholds | Nielsen, *Usability Engineering* (1993); Card, Robertson, Mackinlay (1991) | Pipeline interactive ceilings |
| ITU-T G.1010: interactive transactional <2 s preferred, <4 s acceptable | ITU-T Recommendation G.1010 (2001) | `/api/analyze` budget |
| Apdex (T = target latency, satisfied if ≤T, tolerating ≤4T) | Apdex Alliance, *Apdex Technical Specification V1.1* (2007) | Aggregate scoring of stress runs |
| HTTP latency p50/p95/p99 reporting | Gil Tene, *How NOT to Measure Latency* (2015) | All percentile reports avoid coordinated omission |
| Memory: RSS / Peak Working Set | Linux `getrusage(2)` ru_maxrss; Windows `GetProcessMemoryInfo` PeakWorkingSetSize | Microservice / backend memory caps |
| Load testing methodology | ISO/IEC 25010:2011 §4.2.4 Performance Efficiency (time-behaviour, resource utilization, capacity) | Test categorization |
| k6 / Postman test conventions | Grafana k6 docs; Postman *Learning Center: Writing tests* | Script structure |

### SLA Targets (single source of truth — `system/thresholds.json`)

| Metric | Local Dev | Deployed | Rationale |
|---|---|---|---|
| `/health` p95 latency | ≤ 50 ms | ≤ 200 ms | RAIL <100ms tap |
| `/api/health` p95 latency | ≤ 80 ms | ≤ 250 ms | RAIL + DB warmup |
| `/auth/login` p95 latency | ≤ 250 ms | ≤ 600 ms | bcrypt cost ~10 |
| `/api/analyze` (small <2KB cpp) p95 | ≤ 1500 ms | ≤ 3000 ms | G.1010 interactive |
| `/api/analyze` p99 | ≤ 4000 ms | ≤ 6000 ms | G.1010 acceptable ceiling |
| Microservice cold start | ≤ 800 ms | ≤ 1200 ms | Allocation + catalog load |
| Microservice peak RSS (small input) | ≤ 80 MB | ≤ 120 MB | Empirical baseline + 50% headroom |
| Backend RSS at 50 RPS sustained | ≤ 350 MB | ≤ 500 MB | Node default heap + helmet/morgan |
| Apdex score (T=1s for analyze) | ≥ 0.85 "good" | ≥ 0.70 "fair" | Apdex spec |

> **Note**: The deployed numbers assume the same one-region container; cross-region
> RTT must be added separately if the alpha target is geo-distributed.

## How to Run (TL;DR)

```bash
# 1. Postman connection + SLA gate (local)
#    Import test/alpha/postman/*.json in Postman, pick "Local" env, hit Run
#    or via CLI:
npx newman run test/alpha/postman/NeoTerritory_Alpha.postman_collection.json \
  -e test/alpha/postman/NeoTerritory_Local.postman_environment.json \
  --reporters cli,json --reporter-json-export newman-local.json

# 2. Backend unit tests (no extra deps — uses node:test)
cd test/alpha/unit/backend && npm test

# 3. Microservice unit tests (CTest)
cmake -S test/alpha/unit/microservice -B build/alpha_micro_tests
cmake --build build/alpha_micro_tests
ctest --test-dir build/alpha_micro_tests --output-on-failure

# 4. Backend stress
node test/alpha/stress/backend_stress.js --target http://localhost:3001 \
  --concurrency 50 --duration 30 --report stress-backend.json

# 5. Microservice stress (Windows)
pwsh test/alpha/stress/microservice_stress.ps1 -Iterations 100

# 6. System speed (orchestrates 1+4 and gates on thresholds.json)
pwsh test/alpha/system/system_speed.ps1
```

## What This Suite Does NOT Cover
- Algorithm / pattern-detection accuracy (deferred to test users + qualitative)
- Visual / UX testing
- Security pen-testing (separate `/security-review` flow)
