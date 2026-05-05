# Local component builds — Frontend, Backend, C++ Microservice.

function Invoke-DeployCmd {
  param([string]$Cmd, [switch]$DryRun)
  Write-Host "-> $Cmd"
  if ($DryRun) { return }
  Invoke-Expression $Cmd
  if ($LASTEXITCODE -ne 0) { throw "command failed: $Cmd" }
}

function Build-Frontend {
  param([string]$RootDir, [switch]$DryRun)
  Write-Host '-- Building frontend --'
  Push-Location (Join-Path $RootDir 'Codebase/Frontend')
  try {
    Invoke-DeployCmd 'npm ci'        -DryRun:$DryRun
    Invoke-DeployCmd 'npm run build' -DryRun:$DryRun
  } finally { Pop-Location }
}

function Build-Backend {
  param([string]$RootDir, [switch]$DryRun)
  Write-Host '-- Building backend --'
  Push-Location (Join-Path $RootDir 'Codebase/Backend')
  try {
    Invoke-DeployCmd 'npm ci'        -DryRun:$DryRun
    Invoke-DeployCmd 'npm run build' -DryRun:$DryRun
  } finally { Pop-Location }
}

function Build-Microservice {
  param([string]$RootDir, [switch]$DryRun)
  Write-Host '-- Compiling C++ microservice --'
  $msSrc   = Join-Path $RootDir 'Codebase/Microservice'
  $msBuild = Join-Path $msSrc 'build-linux'
  New-Item -ItemType Directory -Force -Path $msBuild | Out-Null
  Push-Location $msBuild
  try {
    Invoke-DeployCmd "cmake `"$msSrc`""    -DryRun:$DryRun
    Invoke-DeployCmd 'cmake --build . -- -j' -DryRun:$DryRun
  } finally { Pop-Location }
}

function Build-DockerImage {
  param([string]$RootDir, [string]$Dockerfile, [string]$ImageRef, [switch]$DryRun)
  Write-Host "-- Building Docker image $ImageRef --"
  Push-Location $RootDir
  try {
    Invoke-DeployCmd "docker build -f `"$Dockerfile`" -t `"$ImageRef`" ." -DryRun:$DryRun
  } finally { Pop-Location }
}
