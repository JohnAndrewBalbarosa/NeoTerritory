# Backend/.env, microservice build, and node_modules helpers.

function Write-DevEnv {
  param([int]$Port, [int]$VitePort, [string]$AdvertiseHost)
  if (Test-Path $EnvFile) {
    Write-Ok '.env already exists -- leaving in place.'
    return
  }
  Write-Step 'Creating Backend\.env with defaults'
  $cors = "http://localhost:$Port,http://localhost:$VitePort"
  if ($AdvertiseHost -ne 'localhost') {
    $cors += ",http://${AdvertiseHost}:$Port,http://${AdvertiseHost}:$VitePort"
  }
@"
PORT=$Port
CORS_ORIGIN=$cors
DB_PATH=./src/db/database.sqlite

# Anthropic Claude integration. Leave unset to run microservice-only mode.
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Microservice integration. Defaults derived from project layout.
# NEOTERRITORY_BIN=$BinaryPath
# NEOTERRITORY_CATALOG=$MicroserviceDir\pattern_catalog
"@ | Set-Content -Path $EnvFile -Encoding utf8
  Write-Ok ".env created at $EnvFile"
}

function Build-Microservice {
  param([switch]$Force)
  $needsBuild = $Force.IsPresent -or (-not (Test-Path $BinaryPath))
  if (-not $needsBuild) {
    Write-Ok "Microservice binary already built: $BinaryPath"
    return
  }
  Write-Step "Building microservice (CMake -> $BuildDirName)"
  if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir | Out-Null }
  $generator = $null
  if (Test-Tool 'mingw32-make') { $generator = 'MinGW Makefiles' }
  elseif (Test-Tool 'make')     { $generator = 'Unix Makefiles' }
  Push-Location $MicroserviceDir
  try {
    if ($generator) { & cmake -S . -B $BuildDirName -G $generator } else { & cmake -S . -B $BuildDirName }
    if ($LASTEXITCODE -ne 0) { throw 'cmake configure failed.' }
    & cmake --build $BuildDirName --parallel
    if ($LASTEXITCODE -ne 0) { throw 'cmake build failed.' }
  } finally { Pop-Location }
  Write-Ok "Microservice built: $BinaryPath"
}

function Ensure-NodeModules {
  param([string]$Dir, [string]$Label)
  $nm = Join-Path $Dir 'node_modules'
  if (Test-Path $nm) { Write-Ok "$Label node_modules already present."; return }
  Write-Step "Installing $Label npm dependencies"
  Push-Location $Dir
  try { & npm install } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Err "$Label npm install failed."; exit 1 }
  Write-Ok "$Label node_modules installed."
}
