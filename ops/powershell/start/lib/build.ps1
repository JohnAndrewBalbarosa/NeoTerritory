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

function Get-NodePlatformTag {
  # Returns "<os>-<arch>" matching @esbuild/* and @rollup/* native subpackages.
  $os = $null
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { $os = 'win32' }
  elseif ($IsMacOS)                            { $os = 'darwin' }
  elseif ($IsLinux)                            { $os = 'linux' }
  else { return $null }
  $archEnv = $env:PROCESSOR_ARCHITECTURE
  $arch = switch -Regex ($archEnv) {
    'ARM64' { 'arm64' }
    'AMD64' { 'x64' }
    'x86'   { 'ia32' }
    default { 'x64' }
  }
  return "$os-$arch"
}

function Test-NodeModulesPlatform {
  # Returns $true when node_modules native binaries match current platform.
  # Anchored on esbuild — that's where cross-platform copies blow up first.
  param([string]$Dir)
  $plat = Get-NodePlatformTag
  if (-not $plat) { return $true }
  $esbuild = Join-Path $Dir 'node_modules\esbuild'
  if (Test-Path $esbuild) {
    $expected = Join-Path $Dir "node_modules\@esbuild\$plat"
    if (-not (Test-Path $expected)) { return $false }
  }
  $rollup = Join-Path $Dir 'node_modules\rollup'
  if (Test-Path $rollup) {
    $rollupRoot = Join-Path $Dir 'node_modules\@rollup'
    if (Test-Path $rollupRoot) {
      $any   = Get-ChildItem $rollupRoot -Directory -Filter 'rollup-*' -ErrorAction SilentlyContinue
      $match = Get-ChildItem $rollupRoot -Directory -Filter "rollup-$plat*" -ErrorAction SilentlyContinue
      if ($any -and -not $match) { return $false }
    }
  }
  return $true
}

function Ensure-NodeModules {
  param([string]$Dir, [string]$Label)
  $nm = Join-Path $Dir 'node_modules'
  if (Test-Path $nm) {
    if (Test-NodeModulesPlatform -Dir $Dir) {
      Write-Ok "$Label node_modules already present."
      return
    }
    Write-Warn "$Label node_modules built for a different platform -- reinstalling for $(Get-NodePlatformTag)."
    Remove-Item -Recurse -Force $nm
  }
  Write-Step "Installing $Label npm dependencies"
  Push-Location $Dir
  try { & npm install } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Err "$Label npm install failed."; exit 1 }
  Write-Ok "$Label node_modules installed."
}
