# NeoTerritory dev runner.
# Usage: .\run-dev.ps1                       # build (if needed) + start backend + Vite + open browser
#        .\run-dev.ps1 -Rebuild              # force microservice rebuild
#        .\run-dev.ps1 -BackendPort 3055     # custom backend port (default 3001)
#        .\run-dev.ps1 -FrontendPort 5180    # custom Vite port (default 5173)
#        .\run-dev.ps1 -NoBrowser            # don't auto-open browser
#        .\run-dev.ps1 -BackendOnly          # skip Vite (serve legacy static from :3001)

param(
  [switch]$Rebuild,
  [switch]$NoBrowser,
  [switch]$BackendOnly,
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$ProjectRoot      = $PSScriptRoot
$BackendDir       = Join-Path $ProjectRoot 'Codebase\Backend'
$FrontendDir      = Join-Path $ProjectRoot 'Codebase\Frontend'
$MicroserviceDir  = Join-Path $ProjectRoot 'Codebase\Microservice'
$BuildDir         = Join-Path $MicroserviceDir 'build'
$BinaryName       = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'NeoTerritory.exe' } else { 'NeoTerritory' }
$BinaryPath       = Join-Path $BuildDir $BinaryName
$EnvFile          = Join-Path $BackendDir '.env'
$BackendNodeMods  = Join-Path $BackendDir 'node_modules'
$FrontendNodeMods = Join-Path $FrontendDir 'node_modules'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    $msg" -ForegroundColor Red }

function Test-Tool($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Free-Port($port) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    Write-Warn "Port $port already in use by PID $($listener.OwningProcess) - killing it."
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

# 1. Prereq checks (shared verifier, hard-fails for missing dev tools)
$verifierPath = Join-Path $ProjectRoot 'scripts\verify-requirements.ps1'
if (Test-Path $verifierPath) {
  . $verifierPath
  try { Test-Requirements -Profile dev | Out-Null }
  catch { Write-Err $_.Exception.Message; exit 1 }
} else {
  # Fallback when the verifier script isn't present (older clones).
  Write-Step 'Checking tools'
  $missing = @()
  if (-not (Test-Tool 'node'))  { $missing += 'node (https://nodejs.org)' }
  if (-not (Test-Tool 'cmake')) { $missing += 'cmake (https://cmake.org)' }
  $cxxOk = (Test-Tool 'g++') -or (Test-Tool 'clang++') -or (Test-Tool 'cl')
  if (-not $cxxOk) { $missing += 'a C++17 compiler (g++ / clang++ / MSVC cl)' }
  if ($missing.Count -gt 0) {
    Write-Err 'Missing prerequisites:'
    $missing | ForEach-Object { Write-Err "  - $_" }
    Write-Err 'Install them and rerun.'
    exit 1
  }
  Write-Ok 'node, cmake, and a C++ compiler are available.'
}

# 2. Backend deps
if (-not (Test-Path $BackendNodeMods)) {
  Write-Step 'Installing backend npm dependencies'
  Push-Location $BackendDir
  try { & npm install } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Err 'backend npm install failed.'; exit 1 }
  Write-Ok 'Backend node_modules installed.'
} else {
  Write-Ok 'Backend node_modules already present.'
}

# 2b. Frontend deps (skip when -BackendOnly)
if (-not $BackendOnly) {
  if (-not (Test-Path $FrontendNodeMods)) {
    Write-Step 'Installing frontend npm dependencies'
    Push-Location $FrontendDir
    try { & npm install } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { Write-Err 'frontend npm install failed.'; exit 1 }
    Write-Ok 'Frontend node_modules installed.'
  } else {
    Write-Ok 'Frontend node_modules already present.'
  }
}

# 3. .env
if (-not (Test-Path $EnvFile)) {
  Write-Step 'Creating .env with defaults'
  @"
PORT=$BackendPort
CORS_ORIGIN=http://localhost:$BackendPort,http://localhost:$FrontendPort
DB_PATH=./src/db/database.sqlite

# Anthropic Claude integration. Leave unset to run microservice-only mode.
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Microservice integration. Defaults derived from project layout.
# NEOTERRITORY_BIN=$BinaryPath
# NEOTERRITORY_CATALOG=$MicroserviceDir\pattern_catalog
"@ | Set-Content -Path $EnvFile -Encoding utf8
  Write-Ok ".env created at $EnvFile"
} else {
  Write-Ok '.env already exists.'
}

# 4. Microservice build
$needsBuild = $Rebuild -or (-not (Test-Path $BinaryPath))
if ($needsBuild) {
  Write-Step 'Building microservice (CMake + make)'
  if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir | Out-Null }

  # Pick a generator that works with whatever compiler is installed
  $generator = $null
  if (Test-Tool 'mingw32-make') { $generator = 'MinGW Makefiles' }
  elseif (Test-Tool 'make')     { $generator = 'Unix Makefiles' }

  Push-Location $MicroserviceDir
  try {
    if ($generator) {
      & cmake -S . -B build -G $generator
    } else {
      & cmake -S . -B build
    }
    if ($LASTEXITCODE -ne 0) { throw 'cmake configure failed.' }
    & cmake --build build
    if ($LASTEXITCODE -ne 0) { throw 'cmake build failed.' }
  } finally {
    Pop-Location
  }
  Write-Ok "Microservice built: $BinaryPath"
} else {
  Write-Ok "Microservice binary already built: $BinaryPath"
}

# 5. Start backend (TypeScript via tsx — server.js no longer exists after the TS port)
Write-Step "Starting backend on port $BackendPort"
$env:PORT = "$BackendPort"
Free-Port $BackendPort

$serverArgs = @{
  FilePath               = 'npm.cmd'
  ArgumentList           = @('run', 'dev')
  WorkingDirectory       = $BackendDir
  PassThru               = $true
  NoNewWindow            = $true
  RedirectStandardOutput = (Join-Path $BackendDir 'server.out.log')
  RedirectStandardError  = (Join-Path $BackendDir 'server.err.log')
}
$serverProc = Start-Process @serverArgs

# Wait for /api/health
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$BackendPort/api/health" -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if (-not $ready) {
  Write-Err 'Backend did not become healthy within 30s. Last lines of server.err.log:'
  if (Test-Path (Join-Path $BackendDir 'server.err.log')) {
    Get-Content (Join-Path $BackendDir 'server.err.log') -Tail 30 | ForEach-Object { Write-Host "    $_" }
  }
  Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  exit 1
}
Write-Ok 'Backend healthy.'

# 5b. Start Vite dev server (skip when -BackendOnly)
$viteProc = $null
if (-not $BackendOnly) {
  Write-Step "Starting Vite dev server on port $FrontendPort"
  Free-Port $FrontendPort

  $viteArgs = @{
    FilePath               = 'npm.cmd'
    ArgumentList           = @('run', 'dev', '--', '--port', "$FrontendPort", '--strictPort')
    WorkingDirectory       = $FrontendDir
    PassThru               = $true
    NoNewWindow            = $true
    RedirectStandardOutput = (Join-Path $FrontendDir 'vite.out.log')
    RedirectStandardError  = (Join-Path $FrontendDir 'vite.err.log')
  }
  $viteProc = Start-Process @viteArgs

  # Wait for Vite to serve /
  $viteReady = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$FrontendPort/" -TimeoutSec 2
      if ($resp.StatusCode -eq 200) { $viteReady = $true; break }
    } catch { }
  }
  if (-not $viteReady) {
    Write-Err 'Vite did not start within 30s. Last lines of vite.err.log:'
    if (Test-Path (Join-Path $FrontendDir 'vite.err.log')) {
      Get-Content (Join-Path $FrontendDir 'vite.err.log') -Tail 30 | ForEach-Object { Write-Host "    $_" }
    }
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $viteProc.Id   -Force -ErrorAction SilentlyContinue
    exit 1
  }
  Write-Ok 'Vite ready.'
}

$openUrl = if ($BackendOnly) { "http://localhost:$BackendPort" } else { "http://localhost:$FrontendPort" }

Write-Host ''
Write-Host "  Studio UI:    $openUrl" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Health:       http://localhost:$BackendPort/api/health" -ForegroundColor White
Write-Host "  Backend PID:  $($serverProc.Id)" -ForegroundColor White
if ($viteProc) { Write-Host "  Vite PID:     $($viteProc.Id)" -ForegroundColor White }
Write-Host "  Backend log:  $BackendDir\server.out.log" -ForegroundColor White
if ($viteProc) { Write-Host "  Vite log:     $FrontendDir\vite.out.log" -ForegroundColor White }
Write-Host ''
Write-Host 'Press Ctrl+C to stop everything.' -ForegroundColor Gray

if (-not $NoBrowser) {
  Start-Process $openUrl
}

# 6. Tail backend log until Ctrl+C; clean up both processes on exit
try {
  Get-Content -Path (Join-Path $BackendDir 'server.out.log') -Wait -Tail 0
} finally {
  Write-Host ''
  Write-Step 'Shutting down'
  if ($serverProc -and -not $serverProc.HasExited) {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  }
  if ($viteProc -and -not $viteProc.HasExited) {
    Stop-Process -Id $viteProc.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Ok 'Stopped.'
}
