# Root orchestrator for Windows — provisions the whole NeoTerritory stack
# without WSL. Mirrors bootstrap.sh's flag surface so devs can do the same
# things on either OS. Each component also has its own setup.ps1 / setup.sh
# you can run standalone if you only want one piece.
#
# Usage:
#   .\bootstrap.ps1                    # all components
#   .\bootstrap.ps1 -NoInfra           # skip Docker/k8s
#   .\bootstrap.ps1 -Only backend      # backend only
#   .\bootstrap.ps1 -Help              # this help
#
# Note: the existing .\setup.ps1 is the Minikube/k8s deploy entry, unrelated
# to first-time provisioning. Use this file for a fresh dev setup.

param(
    [switch]$NoFrontend,
    [switch]$NoBackend,
    [switch]$NoMicroservice,
    [switch]$NoInfra,
    [string]$Only = "",
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Get-Content $PSCommandPath -TotalCount 18 | Select-Object -Skip 1 | ForEach-Object { Write-Host $_ }
    exit 0
}

$Root = $PSScriptRoot
Set-Location $Root

$DoFrontend = -not $NoFrontend
$DoBackend  = -not $NoBackend
$DoMicro    = -not $NoMicroservice
$DoInfra    = -not $NoInfra

if (-not [string]::IsNullOrWhiteSpace($Only)) {
    $DoFrontend = $false; $DoBackend = $false; $DoMicro = $false; $DoInfra = $false
    switch ($Only.ToLower()) {
        "frontend"     { $DoFrontend = $true }
        "backend"      { $DoBackend = $true }
        "microservice" { $DoMicro = $true }
        "infra"        { $DoInfra = $true }
        default {
            Write-Error "-Only must be one of: frontend|backend|microservice|infra"
            exit 2
        }
    }
}

function Banner($text) {
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor White
}

# Sanity check: required tools. Don't auto-install — surface a clear error
# instead so the dev knows what to run themselves. winget / choco / scoop are
# all reasonable but vary by machine.
function Require-Cmd($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Error "Required command not found on PATH: $name. Install it (winget/choco/scoop) and re-run."
        exit 3
    }
}

Banner "Checking required tools"
Require-Cmd "node"
Require-Cmd "npm"
if ($DoMicro) { Require-Cmd "cmake" }

if ($DoBackend) {
    Banner "Backend"
    Push-Location "Codebase\Backend"
    npm install
    if (-not (Test-Path ".env")) {
        Write-Host "[bootstrap] No .env found — copying .env.example. JWT_SECRET will autogenerate on first start." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
    }
    # Initialize SQLite by importing initDb. Backend autogens JWT_SECRET if missing.
    node -e "require('./dist/db/initDb').initDb && require('./dist/db/initDb').initDb();" 2>$null
    Pop-Location
}

if ($DoFrontend) {
    Banner "Frontend"
    Push-Location "Codebase\Frontend"
    npm install
    Pop-Location
}

if ($DoMicro) {
    Banner "Microservice"
    Push-Location "Codebase\Microservice"
    if (-not (Test-Path "build")) { New-Item -ItemType Directory -Path "build" | Out-Null }
    Push-Location "build"
    cmake .. -G "Visual Studio 17 2022" -A x64 2>$null
    if ($LASTEXITCODE -ne 0) {
        # Fallback to default generator if VS17 isn't installed (e.g. Ninja, MinGW)
        cmake ..
    }
    cmake --build . --config Release
    Pop-Location
    Pop-Location
}

if ($DoInfra) {
    Banner "Infrastructure"
    Write-Host "[bootstrap] Infra setup runs Minikube/k8s steps. Skipping in dev bootstrap;"
    Write-Host "            run .\setup.ps1 explicitly when you want the cluster brought up."
}

Banner "Done"
@"

Single-device dev next steps:
  1. cd Codebase\Backend; node dist\server.js
  2. Open http://localhost:3001  (or PORT from Codebase\Backend\.env)
  3. Admin login: Neoterritory / ragabag123  ->  /admin.html

If JWT_SECRET is empty in .env the backend autogenerates a one-shot secret
on startup; a warning prints to the console. Set JWT_SECRET explicitly to
keep sessions across restarts.
"@ | Write-Host
