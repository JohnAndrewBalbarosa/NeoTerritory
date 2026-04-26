# NeoTerritory dev runner.
# Usage: .\run-dev.ps1                  # build (if needed) + start + open browser
#        .\run-dev.ps1 -Rebuild         # force microservice rebuild
#        .\run-dev.ps1 -Port 3055       # custom port
#        .\run-dev.ps1 -NoBrowser       # don't auto-open browser

param(
  [switch]$Rebuild,
  [switch]$NoBrowser,
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'
$ProjectRoot      = $PSScriptRoot
$BackendDir       = Join-Path $ProjectRoot 'Codebase\Backend'
$MicroserviceDir  = Join-Path $ProjectRoot 'Codebase\Microservice'
$BuildDir         = Join-Path $MicroserviceDir 'build'
$BinaryName       = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'NeoTerritory.exe' } else { 'NeoTerritory' }
$BinaryPath       = Join-Path $BuildDir $BinaryName
$EnvFile          = Join-Path $BackendDir '.env'
$NodeModules      = Join-Path $BackendDir 'node_modules'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    $msg" -ForegroundColor Red }

function Test-Tool($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# 1. Prereq checks
Write-Step 'Checking tools'
$missing = @()
if (-not (Test-Tool 'node'))  { $missing += 'node (https://nodejs.org)' }
if (-not (Test-Tool 'cmake')) { $missing += 'cmake (https://cmake.org)' }
$cxxOk = (Test-Tool 'g++') -or (Test-Tool 'clang++') -or (Test-Tool 'cl')
if (-not $cxxOk) { $missing += 'a C++17 compiler (g++ / clang++ / MSVC cl)' }
if ($missing.Count -gt 0) {
  Write-Err 'Missing prerequisites:'
  $missing | ForEach-Object { Write-Err "  - $_" }
  Write-Err 'Install them and rerun. (Or run .\deploy.ps1 to attempt automated install.)'
  exit 1
}
Write-Ok 'node, cmake, and a C++ compiler are available.'

# 2. Backend deps
if (-not (Test-Path $NodeModules)) {
  Write-Step 'Installing backend npm dependencies'
  Push-Location $BackendDir
  try { & npm install } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Err 'npm install failed.'; exit 1 }
  Write-Ok 'node_modules installed.'
} else {
  Write-Ok 'node_modules already present.'
}

# 3. .env
if (-not (Test-Path $EnvFile)) {
  Write-Step 'Creating .env with defaults'
  @"
PORT=$Port
CORS_ORIGIN=http://localhost:$Port
DB_PATH=./src/db/database.sqlite

# Anthropic Claude integration (D22). Leave unset to run microservice-only mode.
# ANTHROPIC_$1***REDACTED***$2
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Microservice integration (D22). Defaults derived from project layout.
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

# 5. Start backend
Write-Step "Starting backend on port $Port"
$env:PORT = "$Port"

# Free the port if something's already on it
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Warn "Port $Port already in use by PID $($listener.OwningProcess) — killing it."
  Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

# Spawn server
$serverArgs = @{
  FilePath               = 'node'
  ArgumentList           = 'server.js'
  WorkingDirectory       = $BackendDir
  PassThru               = $true
  NoNewWindow            = $true
  RedirectStandardOutput = (Join-Path $BackendDir 'server.out.log')
  RedirectStandardError  = (Join-Path $BackendDir 'server.err.log')
}
$serverProc = Start-Process @serverArgs

# Wait for it to actually listen
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 400
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port/api/health" -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}

if (-not $ready) {
  Write-Err 'Server did not become healthy within 12s. Last lines of server.err.log:'
  if (Test-Path (Join-Path $BackendDir 'server.err.log')) {
    Get-Content (Join-Path $BackendDir 'server.err.log') -Tail 20 | ForEach-Object { Write-Host "    $_" }
  }
  Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

Write-Ok 'Backend healthy.'
Write-Host ''
Write-Host "  Studio UI:   http://localhost:$Port" -ForegroundColor White
Write-Host "  Health:      http://localhost:$Port/api/health" -ForegroundColor White
Write-Host "  Backend PID: $($serverProc.Id)" -ForegroundColor White
Write-Host "  Logs:        $BackendDir\server.out.log" -ForegroundColor White
Write-Host "  Errors:      $BackendDir\server.err.log" -ForegroundColor White
Write-Host ''
Write-Host 'Press Ctrl+C to stop the server.' -ForegroundColor Gray

if (-not $NoBrowser) {
  Start-Process "http://localhost:$Port"
}

# 6. Tail logs until Ctrl+C
try {
  Get-Content -Path (Join-Path $BackendDir 'server.out.log') -Wait -Tail 0
} finally {
  Write-Host ''
  Write-Step 'Shutting down backend'
  if ($serverProc -and -not $serverProc.HasExited) {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Ok 'Stopped.'
}
