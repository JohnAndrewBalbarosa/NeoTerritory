<#
.SYNOPSIS
  Full-stack system speed gate. Orchestrates Postman + stress runs and gates
  pass/fail on thresholds.json.

.DESCRIPTION
  Sequence:
    1. Newman run (connection + contract + per-call SLA)
    2. backend_stress.js against /health  (concurrency 50, duration 20)
    3. backend_stress.js against /api/health (concurrency 25, duration 20)
    4. microservice_stress.ps1 (50 iter, 4 conc)
    5. Read thresholds.json and assert each metric

.PARAMETER Env
  "local" or "deploy" — selects threshold tier and Postman environment.

.EXAMPLE
  pwsh system_speed.ps1 -Env local
#>

[CmdletBinding()]
param(
    [ValidateSet("local","deploy")]
    [string] $Env = "local",
    [string] $BaseUrl = "http://localhost:3001",
    [string] $ReportDir = "$PSScriptRoot/../../../reports/alpha"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$thresholdsPath = Join-Path $PSScriptRoot "thresholds.json"
$thresholds = Get-Content $thresholdsPath -Raw | ConvertFrom-Json
$T = $thresholds.$Env

$postmanEnv = if ($Env -eq "local") {
    "$PSScriptRoot/../postman/NeoTerritory_Local.postman_environment.json"
} else {
    "$PSScriptRoot/../postman/NeoTerritory_Deploy.postman_environment.json"
}
$collection = "$PSScriptRoot/../postman/NeoTerritory_Alpha.postman_collection.json"

$failures = New-Object System.Collections.Generic.List[string]

Write-Host "=== 1/4 Newman (connection + contract + SLA per request) ===" -ForegroundColor Cyan
$newmanReport = Join-Path $ReportDir "newman.json"
& npx -y newman run $collection -e $postmanEnv `
    --reporters cli,json --reporter-json-export $newmanReport
if ($LASTEXITCODE -ne 0) { $failures.Add("newman returned $LASTEXITCODE") }

Write-Host "=== 2/4 Stress /health (50 conc, 20 s) ===" -ForegroundColor Cyan
$healthReport = Join-Path $ReportDir "stress-health.json"
& node "$PSScriptRoot/../stress/backend_stress.js" `
    --target $BaseUrl --route /health `
    --concurrency 50 --duration 20 `
    --apdex-T 0.1 `
    --report $healthReport
if ($LASTEXITCODE -ne 0) { $failures.Add("stress /health returned $LASTEXITCODE") }
$healthRes = Get-Content $healthReport -Raw | ConvertFrom-Json
if ($healthRes.latency_ms.p95 -gt $T.health_p95_ms) {
    $failures.Add("/health p95 $($healthRes.latency_ms.p95) ms > $($T.health_p95_ms) ms")
}

Write-Host "=== 3/4 Stress /api/health (25 conc, 20 s) ===" -ForegroundColor Cyan
$apiHealthReport = Join-Path $ReportDir "stress-api-health.json"
& node "$PSScriptRoot/../stress/backend_stress.js" `
    --target $BaseUrl --route /api/health `
    --concurrency 25 --duration 20 `
    --apdex-T 0.25 `
    --report $apiHealthReport
if ($LASTEXITCODE -ne 0) { $failures.Add("stress /api/health returned $LASTEXITCODE") }
$apiHealthRes = Get-Content $apiHealthReport -Raw | ConvertFrom-Json
if ($apiHealthRes.latency_ms.p95 -gt $T.api_health_p95_ms) {
    $failures.Add("/api/health p95 $($apiHealthRes.latency_ms.p95) ms > $($T.api_health_p95_ms) ms")
}

Write-Host "=== 4/4 Microservice stress (50 iter, 4 conc) ===" -ForegroundColor Cyan
$microReport = Join-Path $ReportDir "stress-micro.json"
& pwsh "$PSScriptRoot/../stress/microservice_stress.ps1" `
    -Iterations 50 -Concurrency 4 -Report $microReport
if ($LASTEXITCODE -ne 0) {
    $failures.Add("microservice stress returned $LASTEXITCODE")
} else {
    $microRes = Get-Content $microReport -Raw | ConvertFrom-Json
    if ($microRes.wall_ms.p95 -gt $T.microservice_cold_ms) {
        $failures.Add("microservice p95 cold $($microRes.wall_ms.p95) ms > $($T.microservice_cold_ms) ms")
    }
    if ($microRes.peak_ws_mb.p95 -gt $T.microservice_rss_mb) {
        $failures.Add("microservice peak RSS $($microRes.peak_ws_mb.p95) MB > $($T.microservice_rss_mb) MB")
    }
}

Write-Host ""
Write-Host "=== Summary (env=$Env) ===" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
    Write-Host "PASS — all metrics within thresholds." -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAIL ($($failures.Count) issues):" -ForegroundColor Red
    foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
    exit 1
}
