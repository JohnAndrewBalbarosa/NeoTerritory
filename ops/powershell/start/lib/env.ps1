# Shared paths and environment-tagged build dir for the C++ microservice.
# Dot-sourced by start.ps1 — runs in caller scope.

# Resolve repo root from this lib file's location: ops/powershell/start/lib/env.ps1 -> ../../../..
$Root            = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$BackendDir      = Join-Path $Root 'Codebase\Backend'
$FrontendDir     = Join-Path $Root 'Codebase\Frontend'
$MicroserviceDir = Join-Path $Root 'Codebase\Microservice'

# Environment-tagged build dir so a Windows-native CMake cache cannot collide
# with one produced under WSL2/MSYS2 (CMake rejects a cache whose absolute
# source path style differs from the current invocation).
$MsEnvTag     = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'win' } else { 'posix' }
$BuildDirName = if ($env:MS_BUILD_DIR) { $env:MS_BUILD_DIR } else { "build-$MsEnvTag" }
$BuildDir     = Join-Path $MicroserviceDir $BuildDirName
$BinaryName   = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'NeoTerritory.exe' } else { 'NeoTerritory' }
$BinaryPath   = Join-Path $BuildDir $BinaryName
$EnvFile      = Join-Path $BackendDir '.env'
$Dockerfile   = Join-Path $Root 'Codebase\Infrastructure\session-orchestration\docker\Dockerfile'
$PodImage     = 'neoterritory/cpp-pod:latest'
