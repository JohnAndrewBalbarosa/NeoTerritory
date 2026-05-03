# ─────────────────────────────────────────────────────────────────────────────
# deploy-aws.ps1 — PowerShell mirror of deploy-aws.sh.
# See scripts/.env.deploy.example for the required keys.
#
# Usage:
#   ./scripts/deploy-aws.ps1                 # build + push everything
#   ./scripts/deploy-aws.ps1 -Frontend
#   ./scripts/deploy-aws.ps1 -Backend -Microservice
#   ./scripts/deploy-aws.ps1 -NoBuild
#   ./scripts/deploy-aws.ps1 -BuildOnly
#   ./scripts/deploy-aws.ps1 -NoSupabase
#   ./scripts/deploy-aws.ps1 -DryRun
# ─────────────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
  [switch]$Frontend,
  [switch]$Backend,
  [switch]$Microservice,
  [switch]$Docker,
  [switch]$NoDocker,
  [switch]$NoBuild,
  [switch]$BuildOnly,
  [switch]$NoSupabase,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$RootDir   = Resolve-Path (Join-Path $PSScriptRoot '..')
$EnvFile   = Join-Path $RootDir 'scripts/.env.deploy'
$Dockerfile = Join-Path $RootDir 'Codebase/Infrastructure/session-orchestration/docker/Dockerfile'

if (-not (Test-Path $EnvFile)) {
  Write-Error "missing $EnvFile — copy scripts/.env.deploy.example and fill it in."
}

# Load .env.deploy into process env.
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k,$v = $_ -split '=',2
  Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}

# Defaults.
if (-not $env:IMAGE_NAME)     { $env:IMAGE_NAME = 'neoterritory' }
if (-not $env:IMAGE_TAG)      { $env:IMAGE_TAG  = 'latest' }
if (-not $env:CONTAINER_NAME) { $env:CONTAINER_NAME = 'neoterritory' }
if (-not $env:AWS_HOST_PORT)  { $env:AWS_HOST_PORT = '80' }

$ImageRef = "$($env:IMAGE_NAME):$($env:IMAGE_TAG)"

# Component selection: default = all when no component flag given.
$AnyComponent = $Frontend -or $Backend -or $Microservice -or $Docker
$DoFrontend     = if ($AnyComponent) { [bool]$Frontend }     else { $true }
$DoBackend      = if ($AnyComponent) { [bool]$Backend }      else { $true }
$DoMicroservice = if ($AnyComponent) { [bool]$Microservice } else { $true }
$DoDocker       = if ($NoDocker)     { $false } elseif ($AnyComponent) { [bool]$Docker } else { $true }
if ($NoBuild) { $DoFrontend = $false; $DoBackend = $false; $DoMicroservice = $false }
$DoPush         = -not $BuildOnly
$UseSupabase    = -not $NoSupabase

function Run-Cmd {
  param([string]$Cmd)
  Write-Host "→ $Cmd"
  if (-not $DryRun) { Invoke-Expression $Cmd; if ($LASTEXITCODE -ne 0) { throw "command failed: $Cmd" } }
}

function Require-Var($name) {
  if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue).Value) {
    throw "$name is required in $EnvFile"
  }
}

if ($DoPush) {
  Require-Var AWS_HOST; Require-Var AWS_USER; Require-Var AWS_SSH_KEY
  if (-not (Test-Path $env:AWS_SSH_KEY)) { throw "AWS_SSH_KEY not found: $($env:AWS_SSH_KEY)" }
}

$SshOpts = "-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -i `"$($env:AWS_SSH_KEY)`""
$SshTarget = "$($env:AWS_USER)@$($env:AWS_HOST)"

# ── 1. Local component builds ───────────────────────────────────────────────
if ($DoFrontend) {
  Write-Host "── Building frontend ──"
  Push-Location (Join-Path $RootDir 'Codebase/Frontend')
  try { Run-Cmd 'npm ci'; Run-Cmd 'npm run build' } finally { Pop-Location }
}
if ($DoBackend) {
  Write-Host "── Building backend ──"
  Push-Location (Join-Path $RootDir 'Codebase/Backend')
  try { Run-Cmd 'npm ci'; Run-Cmd 'npm run build' } finally { Pop-Location }
}
if ($DoMicroservice) {
  Write-Host "── Compiling C++ microservice ──"
  $msBuild = Join-Path $RootDir 'Codebase/Microservice/build-linux'
  New-Item -ItemType Directory -Force -Path $msBuild | Out-Null
  Push-Location $msBuild
  try {
    Run-Cmd "cmake `"$(Join-Path $RootDir 'Codebase/Microservice')`""
    Run-Cmd 'cmake --build . -- -j'
  } finally { Pop-Location }
}

# ── 2. Docker image ─────────────────────────────────────────────────────────
if ($DoDocker) {
  Write-Host "── Building Docker image $ImageRef ──"
  Push-Location $RootDir
  try { Run-Cmd "docker build -f `"$Dockerfile`" -t `"$ImageRef`" ." } finally { Pop-Location }
}

if (-not $DoPush) { Write-Host "✓ build-only: skipping ship to $($env:AWS_HOST)"; return }

# ── 3. Ship to AWS via SSH ──────────────────────────────────────────────────
Write-Host "── Shipping image to $SshTarget ──"
if ($DryRun) {
  Write-Host "→ docker save $ImageRef | ssh $SshTarget 'docker load'"
} else {
  $tmp = New-TemporaryFile
  try {
    docker save $ImageRef -o $tmp.FullName
    if ($LASTEXITCODE -ne 0) { throw 'docker save failed' }
    Invoke-Expression "ssh $SshOpts `"$SshTarget`" 'docker load' < `"$($tmp.FullName)`""
  } finally { Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue }
}

# Build remote env file content.
$envLines = @('PORT=3001','NODE_ENV=production')
foreach ($k in 'JWT_SECRET','ANTHROPIC_API_KEY','ADMIN_USERNAME','ADMIN_PASSWORD') {
  $v = (Get-Item "Env:$k" -ErrorAction SilentlyContinue).Value
  if ($v) { $envLines += "$k=$v" }
}
if ($UseSupabase -and $env:SUPABASE_URL -and $env:SUPABASE_SERVICE_KEY) {
  $envLines += "SUPABASE_URL=$($env:SUPABASE_URL)"
  $envLines += "SUPABASE_SERVICE_KEY=$($env:SUPABASE_SERVICE_KEY)"
  if ($env:SUPABASE_LOGS_TABLE)  { $envLines += "SUPABASE_LOGS_TABLE=$($env:SUPABASE_LOGS_TABLE)" }
  if ($env:SUPABASE_AUDIT_TABLE) { $envLines += "SUPABASE_AUDIT_TABLE=$($env:SUPABASE_AUDIT_TABLE)" }
  Write-Host "✓ Supabase mirror enabled (admin/audit logs → $($env:SUPABASE_URL))"
} else {
  Write-Host "ℹ Supabase mirror disabled — container will use local SQLite only"
}

$remoteEnv = "/tmp/$($env:CONTAINER_NAME).env.$PID"
if ($DryRun) {
  Write-Host "→ scp env to $remoteEnv ; ssh restart container"
} else {
  $localTmp = New-TemporaryFile
  try {
    Set-Content -Path $localTmp.FullName -Value ($envLines -join "`n") -Encoding ascii -NoNewline
    Invoke-Expression "scp $SshOpts `"$($localTmp.FullName)`" `"$($SshTarget):$remoteEnv`""
  } finally { Remove-Item $localTmp.FullName -Force -ErrorAction SilentlyContinue }

  $remoteScript = @"
set -e
docker rm -f "$($env:CONTAINER_NAME)" 2>/dev/null || true
docker run -d \
  --name "$($env:CONTAINER_NAME)" \
  --restart unless-stopped \
  -p $($env:AWS_HOST_PORT):3001 \
  --env-file "$remoteEnv" \
  -v $($env:CONTAINER_NAME)-data:/app/Codebase/Backend/src/db \
  "$ImageRef"
shred -u "$remoteEnv" 2>/dev/null || rm -f "$remoteEnv"
docker ps --filter "name=$($env:CONTAINER_NAME)"
"@
  $remoteScript | & ssh $SshOpts.Split(' ') $SshTarget 'bash -s'
}

Write-Host "✓ Deployed $ImageRef → http://$($env:AWS_HOST):$($env:AWS_HOST_PORT)"
