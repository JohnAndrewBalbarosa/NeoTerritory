# ─────────────────────────────────────────────────────────────────────────────
# deploy-aws.ps1 — PowerShell mirror of deploy-aws.sh.
# See scripts/.env.deploy.example for the required keys.
#
# Two ship modes:
#   -Image  (default) Build locally, docker save | ssh docker load (heavy upload).
#   -Source           Tar the repo, scp to remote, remote runs docker build
#                     itself (tiny upload, auto-installs docker if missing).
#
# Usage:
#   ./scripts/deploy-aws.ps1                 # image mode, build + push everything
#   ./scripts/deploy-aws.ps1 -Source         # ship source, build on AWS side
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
  [switch]$Source,    # ship source, remote builds
  [switch]$Image,     # ship pre-built image (default)
  [switch]$DryRun
)
$ShipMode = if ($Source) { 'source' } else { 'image' }

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

# Reject publishable / anon Supabase keys — RLS will silently drop every INSERT.
if ($env:SUPABASE_SERVICE_KEY -and ($env:SUPABASE_SERVICE_KEY -match '^(sb_publishable_|sb_anon_)')) {
  Write-Warning "SUPABASE_SERVICE_KEY looks like a publishable/anon key — admin-log mirror DISABLED."
  Write-Warning "Get the service-role key from Supabase -> Settings -> API -> 'service_role secret'."
  $env:SUPABASE_SERVICE_KEY = ''
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
if ($ShipMode -eq 'source') {
  $DoFrontend = $false; $DoBackend = $false; $DoMicroservice = $false; $DoDocker = $false
}
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
$RemoteAppDir = if ($env:REMOTE_APP_DIR) { $env:REMOTE_APP_DIR } else { "/home/$($env:AWS_USER)/neoterritory" }

if ($ShipMode -eq 'source') {
  Write-Host "── Shipping SOURCE to $SshTarget`:$RemoteAppDir (remote will build) ──"
  if ($DryRun) {
    Write-Host "→ tar source → ssh $SshTarget 'untar + docker build $ImageRef'"
  } else {
    $tarTmp = New-TemporaryFile
    try {
      # ALLOWLIST: only paths the docker build actually needs leave the laptop.
      $includes = @(
        'Codebase/Backend',
        'Codebase/Frontend',
        'Codebase/Microservice',
        'Codebase/Infrastructure/session-orchestration/docker',
        'scripts',
        'start.sh',
        'start.ps1'
      )
      $excludes = @(
        '--exclude=**/.git','--exclude=**/node_modules',
        '--exclude=**/dist','--exclude=**/build','--exclude=**/build-linux',
        '--exclude=**/out','--exclude=**/.next','--exclude=**/.cache',
        '--exclude=**/coverage','--exclude=**/__pycache__',
        '--exclude=**/*.log','--exclude=**/*.tsbuildinfo',
        '--exclude=**/*.sqlite','--exclude=**/*.sqlite-journal',
        '--exclude=**/.DS_Store','--exclude=**/Thumbs.db',
        '--exclude=**/*.pem','--exclude=**/*.key',
        '--exclude=**/.env','--exclude=**/.env.*',
        '--exclude=Codebase/Backend/uploads','--exclude=Codebase/Backend/outputs',
        '--exclude=Codebase/Backend/server.out.log','--exclude=Codebase/Backend/server.err.log',
        '--exclude=Codebase/Backend/keys',
        '--exclude=Codebase/Microservice/Test'
      )
      Push-Location $RootDir
      try { & tar @excludes -czf $tarTmp.FullName @includes } finally { Pop-Location }
      if ($LASTEXITCODE -ne 0) { throw 'tar failed' }
      Invoke-Expression "ssh $SshOpts `"$SshTarget`" `"mkdir -p '$RemoteAppDir'`""
      Invoke-Expression "scp $SshOpts `"$($tarTmp.FullName)`" `"$($SshTarget):/tmp/neoterritory-src.tgz`""
      $remoteBuild = @"
set -e
cd "$RemoteAppDir"
tar -xzf /tmp/neoterritory-src.tgz
rm -f /tmp/neoterritory-src.tgz
if ! command -v docker >/dev/null 2>&1; then
  echo '→ installing docker on remote'
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "\$USER" || true
fi
docker build -f "Codebase/Infrastructure/session-orchestration/docker/Dockerfile" -t "$ImageRef" .
"@
      $remoteBuild | & ssh $SshOpts.Split(' ') $SshTarget 'bash -s'
    } finally { Remove-Item $tarTmp.FullName -Force -ErrorAction SilentlyContinue }
  }
} else {
  Write-Host "── Shipping IMAGE to $SshTarget ──"
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
}

# Build remote env file content.
$envLines = @('PORT=3001','NODE_ENV=production')
foreach ($k in 'JWT_SECRET','GEMINI_API_KEY','GEMINI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL','AI_PROVIDER','ADMIN_USERNAME','ADMIN_PASSWORD') {
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
