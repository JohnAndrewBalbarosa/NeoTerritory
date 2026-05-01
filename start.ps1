# NeoTerritory — one-script run-all.
#
# Replaces the manual ".\run-dev.ps1" then ".\clean-browser.ps1" two-step.
# Also nudges the Docker pod image so the per-tester sandbox is ready
# before the first tester signs in. The microservice (annotated-source
# pattern detection) keeps using the local C++ build executable; only
# code EXECUTION inside GDB unit tests routes through the per-user pod.
#
# Usage:
#   .\start.ps1
#   .\start.ps1 -Rebuild              # force microservice rebuild
#   .\start.ps1 -BackendOnly          # skip Vite (serve legacy static from :3001)
#   .\start.ps1 -NoBrowser            # don't open a clean Chromium
#   .\start.ps1 -BackendPort 3055 -FrontendPort 5180
#   .\start.ps1 -SkipPod              # don't pre-build the cpp-pod image (backend will lazy-build on first claim)
#   .\start.ps1 -UseChrome            # use installed Chrome instead of Playwright Chromium
#
# Stop with Ctrl+C — backend, Vite, and the launched browser all exit.

param(
  [switch]$Rebuild,
  [switch]$NoBrowser,
  [switch]$BackendOnly,
  [switch]$SkipPod,
  [switch]$UseChrome,
  [int]$BackendPort  = 3001,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$Root         = $PSScriptRoot
$BackendDir   = Join-Path $Root 'Codebase\Backend'
$Dockerfile   = Join-Path $BackendDir 'docker\cpp-pod.Dockerfile'
$PodImage     = 'neoterritory/cpp-pod:latest'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Test-Tool($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

# ── 0. Requirements check (shared verifier) ──────────────────────────────────
. (Join-Path $Root 'scripts\verify-requirements.ps1')
# Pods profile when Docker is intended; soft-fail so the script continues
# with a warning if Docker Desktop isn't running yet.
$reqProfile = if ($SkipPod) { 'dev' } else { 'pods' }
$report = Test-Requirements -Profile $reqProfile -Soft

# ── 1. Pod image (one-time host build, tiny re-check on every start) ─────────

if (-not $SkipPod) {
  Write-Step 'Checking Docker pod image (one-time per host)'
  if (-not $report.docker) {
    Write-Warn 'docker not on PATH — pod isolation skipped; backend will use local sandbox for GDB unit tests.'
    Write-Warn 'Install Docker Desktop from https://www.docker.com/products/docker-desktop and re-run .\start.ps1.'
  } elseif (-not $report.dockerDaemon) {
    Write-Warn 'docker is installed but the daemon is not responding — start Docker Desktop and re-run .\start.ps1.'
    Write-Warn 'Pod build skipped; backend will use local sandbox for GDB unit tests.'
  } else {
    $imageProbe = & docker image inspect $PodImage 2>$null
    if ($LASTEXITCODE -ne 0) {
      if (Test-Path $Dockerfile) {
        Write-Step "Building $PodImage from $Dockerfile (one-time, ~30-60s)"
        & docker build -f $Dockerfile -t $PodImage (Split-Path $Dockerfile)
        if ($LASTEXITCODE -ne 0) {
          Write-Warn 'docker build failed — backend will fall back to local sandbox for GDB unit tests.'
        } else {
          Write-Ok "$PodImage ready."
        }
      } else {
        Write-Warn "Dockerfile not found at $Dockerfile — pod isolation unavailable."
      }
    } else {
      Write-Ok "$PodImage already built."
    }
  }
}

# ── 2. Hand off to run-dev.ps1 — backend + Vite + microservice + .env ────────
# run-dev.ps1 is the source of truth for the dev pipeline. We invoke it as a
# child job so its tail-stdout loop runs in the foreground and Ctrl+C still
# tears everything down. Then we open a clean Chromium pointed at the studio
# URL once it's confirmed ready.

$runDevArgs = @()
if ($Rebuild)     { $runDevArgs += '-Rebuild' }
if ($BackendOnly) { $runDevArgs += '-BackendOnly' }
$runDevArgs += @('-BackendPort', $BackendPort, '-FrontendPort', $FrontendPort)
# We open the browser ourselves (clean profile) so always pass -NoBrowser to
# run-dev to prevent it from launching the user's default browser too.
$runDevArgs += '-NoBrowser'

Write-Step "Launching backend + Vite via run-dev.ps1 ($(($runDevArgs -join ' ')))"
$runDevPath = Join-Path $Root 'run-dev.ps1'
$runDevProc = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runDevPath, $runDevArgs) `
  -PassThru -NoNewWindow

# ── 3. Wait for the backend's /api/health, then for Vite's / ─────────────────

function Wait-Url($url, $label, $tries = 120) {
  for ($i = 0; $i -lt $tries; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
  }
  Write-Warn "$label did not respond at $url after $tries tries."
  return $false
}

$openUrl = if ($BackendOnly) { "http://localhost:$BackendPort" } else { "http://localhost:$FrontendPort" }
Write-Step "Waiting for studio at $openUrl"
$ready = Wait-Url $openUrl 'Studio'
if (-not $ready) {
  Write-Warn 'Studio not ready — opening anyway; check the run-dev window for errors.'
}

# ── 4. Open a clean Chromium pointed at the studio ───────────────────────────

if (-not $NoBrowser) {
  $cleanArgs = @($openUrl)
  if (-not $UseChrome) { $cleanArgs = @('-Playwright') + $cleanArgs }
  Write-Step "Launching clean Chromium ($(if ($UseChrome) { 'Chrome' } else { 'Playwright' }))"
  $cleanScript = Join-Path $Root 'clean-browser.ps1'
  Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $cleanScript, $cleanArgs) | Out-Null
}

Write-Host ''
Write-Host "  Studio:       $openUrl"          -ForegroundColor White
Write-Host "  Backend API:  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Health:       http://localhost:$BackendPort/api/health" -ForegroundColor White
Write-Host ''
Write-Host 'Ctrl+C in this window stops the backend, Vite, and the browser.' -ForegroundColor Gray

# ── 5. Block on the run-dev child so Ctrl+C cascades ─────────────────────────

try {
  Wait-Process -Id $runDevProc.Id
} finally {
  if ($runDevProc -and -not $runDevProc.HasExited) {
    Stop-Process -Id $runDevProc.Id -Force -ErrorAction SilentlyContinue
  }
}
