# Loads scripts/.env.deploy into the process env, applies defaults, and
# validates the keys required for the chosen ship mode.

function Import-DeployEnv {
  param([string]$EnvFile)
  if (-not (Test-Path $EnvFile)) {
    throw "missing $EnvFile - copy scripts/.env.deploy.example and fill it in."
  }
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k,$v = $_ -split '=',2
    Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
  }

  # Reject publishable / anon Supabase keys - RLS will silently drop every INSERT.
  if ($env:SUPABASE_SERVICE_KEY -and ($env:SUPABASE_SERVICE_KEY -match '^(sb_publishable_|sb_anon_)')) {
    Write-Warning "SUPABASE_SERVICE_KEY looks like a publishable/anon key - admin-log mirror DISABLED."
    Write-Warning "Get the service-role key from Supabase -> Settings -> API -> 'service_role secret'."
    $env:SUPABASE_SERVICE_KEY = ''
  }

  if (-not $env:IMAGE_NAME)     { $env:IMAGE_NAME = 'neoterritory' }
  if (-not $env:IMAGE_TAG)      { $env:IMAGE_TAG  = 'latest' }
  if (-not $env:CONTAINER_NAME) { $env:CONTAINER_NAME = 'neoterritory' }
  if (-not $env:AWS_HOST_PORT)  { $env:AWS_HOST_PORT = '80' }
}

function Require-EnvVar {
  param([string]$Name, [string]$EnvFile)
  $v = (Get-Item "Env:$Name" -ErrorAction SilentlyContinue).Value
  if (-not $v) { throw "$Name is required in $EnvFile" }
}

function Assert-PushPrereqs {
  param([string]$EnvFile)
  Require-EnvVar AWS_HOST    $EnvFile
  Require-EnvVar AWS_USER    $EnvFile
  Require-EnvVar AWS_SSH_KEY $EnvFile
  if (-not (Test-Path $env:AWS_SSH_KEY)) { throw "AWS_SSH_KEY not found: $($env:AWS_SSH_KEY)" }
}

function Get-RemoteAppDir {
  if ($env:REMOTE_APP_DIR) { return $env:REMOTE_APP_DIR }
  return "/home/$($env:AWS_USER)/neoterritory"
}
