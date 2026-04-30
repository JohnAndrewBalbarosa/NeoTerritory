# NeoTerritory deployment script.
# Idempotent automated setup for a fresh machine. Safe to rerun.
#
# Usage: .\deploy.ps1                       # interactive prereq install + full build
#        .\deploy.ps1 -SkipPrereqInstall    # only verify prereqs, skip auto-install
#        .\deploy.ps1 -AutoStart            # also start the server at the end
#        .\deploy.ps1 -Port 3001            # set the configured port
#        .\deploy.ps1 -AnthropicKey sk-...  # write ANTHROPIC_API_KEY into .env

param(
  [switch]$SkipPrereqInstall,
  [switch]$AutoStart,
  [int]$Port = 3001,
  [string]$AnthropicKey,
  [string]$AnthropicModel = 'claude-sonnet-4-6'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot     = $PSScriptRoot
$BackendDir      = Join-Path $ProjectRoot 'Codebase\Backend'
$MicroserviceDir = Join-Path $ProjectRoot 'Codebase\Microservice'
$BuildDir        = Join-Path $MicroserviceDir 'build'
$BinaryName      = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'NeoTerritory.exe' } else { 'NeoTerritory' }
$BinaryPath      = Join-Path $BuildDir $BinaryName
$EnvFile         = Join-Path $BackendDir '.env'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [warn] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [err] $msg" -ForegroundColor Red }

function Test-Tool($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Try-WingetInstall($id, $friendly) {
  if ($SkipPrereqInstall) {
    Write-Warn "$friendly missing. -SkipPrereqInstall is set; please install manually."
    return $false
  }
  if (-not (Test-Tool 'winget')) {
    Write-Warn "$friendly missing and winget unavailable. Install $friendly manually."
    return $false
  }
  Write-Step "Installing $friendly via winget ($id)"
  & winget install --id $id --accept-source-agreements --accept-package-agreements -e --silent
  return ($LASTEXITCODE -eq 0)
}

# =========================================================================
# Phase 1: Prerequisite tooling
# =========================================================================
Write-Step 'Phase 1: Verify prerequisites'

if (-not (Test-Tool 'node')) {
  if (Try-WingetInstall 'OpenJS.NodeJS.LTS' 'Node.js LTS') { Write-Ok 'Node.js installed.' }
  else { Write-Err 'Node.js is required. Install from https://nodejs.org and rerun.'; exit 1 }
} else {
  Write-Ok "Node.js: $(node --version)"
}

if (-not (Test-Tool 'npm')) {
  Write-Err 'npm not found (should ship with Node).'; exit 1
}

if (-not (Test-Tool 'cmake')) {
  if (Try-WingetInstall 'Kitware.CMake' 'CMake') { Write-Ok 'CMake installed.' }
  else { Write-Err 'CMake is required. Install from https://cmake.org and rerun.'; exit 1 }
} else {
  Write-Ok "CMake: $((cmake --version | Select-Object -First 1))"
}

$cxxOk = (Test-Tool 'g++') -or (Test-Tool 'clang++') -or (Test-Tool 'cl')
if (-not $cxxOk) {
  Write-Warn 'No C++ compiler detected (g++ / clang++ / cl).'
  if (Try-WingetInstall 'MSYS2.MSYS2' 'MSYS2 (provides MinGW g++)') {
    Write-Ok 'MSYS2 installed. You may need to open a fresh shell, run `pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-make`, and add C:\msys64\ucrt64\bin to PATH.'
  } else {
    Write-Err 'A C++17 compiler is required. Install MSYS2 (mingw) or LLVM clang or MSVC build tools.'
    exit 1
  }
  $cxxOk = (Test-Tool 'g++') -or (Test-Tool 'clang++') -or (Test-Tool 'cl')
  if (-not $cxxOk) { Write-Err 'Compiler still not on PATH after install. Open a new shell and rerun.'; exit 1 }
} else {
  if (Test-Tool 'g++')        { Write-Ok "Compiler: g++ ($(g++ --version | Select-Object -First 1))" }
  elseif (Test-Tool 'clang++'){ Write-Ok "Compiler: clang++ ($(clang++ --version | Select-Object -First 1))" }
  else                        { Write-Ok 'Compiler: MSVC cl' }
}

# =========================================================================
# Phase 2: Backend dependencies
# =========================================================================
Write-Step 'Phase 2: Backend npm install'
Push-Location $BackendDir
try {
  & npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  Write-Ok 'Backend dependencies installed.'
} finally {
  Pop-Location
}

# =========================================================================
# Phase 3: Microservice build
# =========================================================================
Write-Step 'Phase 3: Microservice build'
if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null }

$generator = $null
if (Test-Tool 'mingw32-make') { $generator = 'MinGW Makefiles' }
elseif (Test-Tool 'make')     { $generator = 'Unix Makefiles' }

Push-Location $MicroserviceDir
try {
  if ($generator) { & cmake -S . -B build -G $generator } else { & cmake -S . -B build }
  if ($LASTEXITCODE -ne 0) { throw 'cmake configure failed.' }
  & cmake --build build --parallel
  if ($LASTEXITCODE -ne 0) { throw 'cmake build failed.' }
} finally {
  Pop-Location
}

if (-not (Test-Path $BinaryPath)) {
  Write-Err "Build completed but binary not found at $BinaryPath."
  exit 1
}
Write-Ok "Microservice built: $BinaryPath"

# Smoke-test the binary against the integration sample
$IntegrationSample = Join-Path $MicroserviceDir 'samples\integration\all_patterns.cpp'
$SmokeOutput       = Join-Path $env:TEMP 'neoterritory-smoke'
if (Test-Path $IntegrationSample) {
  Write-Step 'Smoke-testing the microservice on the integration sample'
  if (Test-Path $SmokeOutput) { Remove-Item -Recurse -Force $SmokeOutput }
  & $BinaryPath --catalog (Join-Path $MicroserviceDir 'pattern_catalog') --output $SmokeOutput $IntegrationSample
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Smoke test failed: microservice exited non-zero.'
    exit 1
  }
  $reportPath = Join-Path $SmokeOutput 'report.json'
  if (-not (Test-Path $reportPath)) {
    Write-Err 'Smoke test failed: no report.json produced.'
    exit 1
  }
  $report = Get-Content $reportPath | ConvertFrom-Json
  $matches = ($report.detected_patterns | Measure-Object).Count
  if ($matches -lt 1) { Write-Err 'Smoke test failed: zero pattern matches on integration sample.'; exit 1 }
  Write-Ok "Smoke test passed: $matches pattern match(es) detected."
}

# =========================================================================
# Phase 4: .env configuration
# =========================================================================
Write-Step 'Phase 4: Backend .env configuration'

$envLines = @(
  "PORT=$Port",
  "CORS_ORIGIN=http://localhost:$Port",
  'DB_PATH=./src/db/database.sqlite',
  '',
  '# Anthropic Claude integration (D22). Leave unset to run microservice-only mode.'
)
if ($AnthropicKey) {
  $envLines += "ANTHROPIC_API_KEY=$AnthropicKey"
  $envLines += "ANTHROPIC_MODEL=$AnthropicModel"
} else {
  $envLines += '# ANTHROPIC_API_KEY=sk-ant-...'
  $envLines += "# ANTHROPIC_MODEL=$AnthropicModel"
}
$envLines += ''
$envLines += '# Microservice integration (D22).'
$envLines += "NEOTERRITORY_BIN=$BinaryPath"
$envLines += "NEOTERRITORY_CATALOG=$(Join-Path $MicroserviceDir 'pattern_catalog')"

if (Test-Path $EnvFile) {
  $backupName = ".env.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $EnvFile (Join-Path $BackendDir $backupName)
  Write-Warn "Existing .env backed up to $backupName"
}
$envLines | Set-Content -Path $EnvFile -Encoding utf8
Write-Ok ".env written at $EnvFile (port=$Port, anthropic=$([bool]$AnthropicKey))"

# =========================================================================
# Phase 5: Database init (the server initializes on first run, but we warm it)
# =========================================================================
Write-Step 'Phase 5: Database warm-up'
Push-Location $BackendDir
try {
  & node -e "const { initDb } = require('./src/db/initDb'); initDb(); console.log('schema initialized');"
  if ($LASTEXITCODE -ne 0) { throw 'DB init failed.' }
  Write-Ok 'Database schema initialized (users, jobs, logs, etl_*, analysis_runs created if absent).'
} finally {
  Pop-Location
}

# =========================================================================
# Phase 6: Done
# =========================================================================
Write-Host ''
Write-Step 'Deployment complete'
Write-Ok "Project root:   $ProjectRoot"
Write-Ok "Studio UI:      http://localhost:$Port (after start)"
Write-Ok "Health:         http://localhost:$Port/api/health"
Write-Ok "Run later via:  .\run-dev.ps1"
if (-not $AnthropicKey) {
  Write-Warn 'No ANTHROPIC_API_KEY set — AI documentation will return "pending_provider".'
  Write-Warn '   Set it later by editing Codebase\Backend\.env or rerunning with -AnthropicKey.'
}

if ($AutoStart) {
  Write-Host ''
  Write-Step 'Starting server now (-AutoStart)'
  & (Join-Path $ProjectRoot 'run-dev.ps1') -Port $Port
}
