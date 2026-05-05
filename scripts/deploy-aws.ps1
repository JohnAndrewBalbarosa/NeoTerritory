# -----------------------------------------------------------------------------
# deploy-aws.ps1 - PowerShell mirror of deploy-aws.sh.
# See scripts/.env.deploy.example for the required keys.
#
# Slim dispatcher. All real logic lives under scripts/deploy/lib/*.ps1.
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
# -----------------------------------------------------------------------------
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

$ErrorActionPreference = 'Stop'
$RootDir   = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvFile   = Join-Path $RootDir 'scripts/.env.deploy'
$Dockerfile = Join-Path $RootDir 'Codebase/Infrastructure/session-orchestration/docker/Dockerfile'
$LibDir    = (Resolve-Path (Join-Path $PSScriptRoot '..\ops\powershell\deploy\lib')).Path

. (Join-Path $LibDir 'env.ps1')
. (Join-Path $LibDir 'components.ps1')
. (Join-Path $LibDir 'aws.ps1')
. (Join-Path $LibDir 'ssl.ps1')
. (Join-Path $LibDir 'ship.ps1')
. (Join-Path $LibDir 'remote-run.ps1')
. (Join-Path $LibDir 'probe.ps1')

Import-DeployEnv -EnvFile $EnvFile
$ImageRef = "$($env:IMAGE_NAME):$($env:IMAGE_TAG)"
$ShipMode = if ($Source) { 'source' } else { 'image' }

# Component selection: default = all when no component flag given.
$AnyComponent = $Frontend -or $Backend -or $Microservice -or $Docker
$DoFrontend     = if ($AnyComponent) { [bool]$Frontend }     else { $true }
$DoBackend      = if ($AnyComponent) { [bool]$Backend }      else { $true }
$DoMicroservice = if ($AnyComponent) { [bool]$Microservice } else { $true }
$DoDocker       = if ($NoDocker)     { $false } elseif ($AnyComponent) { [bool]$Docker } else { $true }
if ($NoBuild)              { $DoFrontend = $false; $DoBackend = $false; $DoMicroservice = $false }
if ($ShipMode -eq 'source') { $DoFrontend = $false; $DoBackend = $false; $DoMicroservice = $false; $DoDocker = $false }
$DoPush      = -not $BuildOnly
$UseSupabase = -not $NoSupabase

if ($DoPush) { Assert-PushPrereqs -EnvFile $EnvFile }

$SshOpts   = "-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -i `"$($env:AWS_SSH_KEY)`""
$SshTarget = "$($env:AWS_USER)@$($env:AWS_HOST)"

# --- 1. Local component builds ----------------------------------------------
if ($DoFrontend)     { Build-Frontend     -RootDir $RootDir -DryRun:$DryRun }
if ($DoBackend)      { Build-Backend      -RootDir $RootDir -DryRun:$DryRun }
if ($DoMicroservice) { Build-Microservice -RootDir $RootDir -DryRun:$DryRun }

# --- 2. Docker image --------------------------------------------------------
if ($DoDocker) { Build-DockerImage -RootDir $RootDir -Dockerfile $Dockerfile -ImageRef $ImageRef -DryRun:$DryRun }

if (-not $DoPush) { Write-Host "build-only: skipping ship to $($env:AWS_HOST)"; return }

# --- 2.5/2.6 Lightsail firewall + SSL ---------------------------------------
Open-LightsailPorts -ScriptRoot $PSScriptRoot -DryRun:$DryRun
Invoke-SslSetup     -SshOpts $SshOpts -SshTarget $SshTarget -DryRun:$DryRun

# --- 3. Ship to AWS via SSH -------------------------------------------------
$RemoteAppDir = Get-RemoteAppDir
if ($ShipMode -eq 'source') {
  Ship-Source -RootDir $RootDir -SshOpts $SshOpts -SshTarget $SshTarget `
              -RemoteAppDir $RemoteAppDir -ImageRef $ImageRef -DryRun:$DryRun
} else {
  Ship-Image  -SshOpts $SshOpts -SshTarget $SshTarget -ImageRef $ImageRef -DryRun:$DryRun
}

# --- 4. Remote env + container restart --------------------------------------
Restart-RemoteContainer -SshOpts $SshOpts -SshTarget $SshTarget `
                        -ImageRef $ImageRef -UseSupabase $UseSupabase -DryRun:$DryRun

# --- 5. Probe ---------------------------------------------------------------
$publicUrl = Get-PublicUrl
Write-Host "Deployed $ImageRef -> $publicUrl"

if (-not $DryRun -and $DoPush) {
  if (-not (Test-PublicUrl -PublicUrl $publicUrl)) {
    Write-Warning "External probe failed. Check Lightsail console -> Networking -> IPv4 Firewall and 'docker logs $($env:CONTAINER_NAME)' on the remote."
    exit 2
  }
}
