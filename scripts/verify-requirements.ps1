# Run directly:  .\scripts\verify-requirements.ps1 [-Profile dev] [-Soft]
# Dot-source:    . "$PSScriptRoot\scripts\verify-requirements.ps1"
#                Test-Requirements -Profile dev
param(
  [ValidateSet('minimal','dev','pods','full')]
  [string]$Profile = 'dev',
  [switch]$Soft
)

# NeoTerritory - shared requirements verifier (PowerShell side).
#
# STRICT BY DEFAULT, SEQUENTIAL. NeoTerritory is a high-criticality app;
# scripts that run it stop the moment a required tool is missing. Each
# check runs in dependency order and throws on the FIRST miss without
# probing the rest — there's no point telling the operator about a
# missing g++ when node isn't installed yet.
#
# Sourced by start.ps1, run-dev.ps1, deploy.ps1, etc. via dot-sourcing:
#     . "$PSScriptRoot\scripts\verify-requirements.ps1"
#     Test-Requirements -Profile dev               # strict — throws on first miss
#     Test-Requirements -Profile pods -Soft        # WARNINGS only — never throws
#
# Profiles:
#   minimal     node, npm
#   dev         minimal + cmake + a C++17 compiler
#   pods        dev + docker on PATH + docker daemon responding
#   full        pods + git
#
# Soft mode is for orchestrators that legitimately need to keep going
# with a degraded surface (bootstrap.ps1 for example, which installs
# the missing tools itself). End-user scripts should use strict default.

function Test-Requirements {
  param(
    [ValidateSet('minimal','dev','pods','full')]
    [string]$Profile = 'dev',
    [switch]$Soft,
    [switch]$AutoInstall
  )

  $strict = -not $Soft

  # Mapping for winget installations
  $ToolMap = @{
    'node'   = @{ ID = 'OpenJS.NodeJS.LTS'; Friendly = 'Node.js LTS' }
    'npm'    = @{ ID = 'OpenJS.NodeJS.LTS'; Friendly = 'npm (via Node.js)' }
    'cmake'  = @{ ID = 'Kitware.CMake'; Friendly = 'CMake' }
    'git'    = @{ ID = 'Git.Git'; Friendly = 'Git' }
    'docker' = @{ ID = 'Docker.DockerDesktop'; Friendly = 'Docker Desktop' }
    'g++'    = @{ ID = 'MSYS2.MSYS2'; Friendly = 'MSYS2 (MinGW g++)' }
  }

  function Has($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
  function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
  function Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
  function Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
  function Err($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

  function Try-Install($name) {
    if (-not $AutoInstall) { return $false }
    if (-not $ToolMap.ContainsKey($name)) { return $false }
    if (-not (Has 'winget')) { Warn 'winget not found, cannot auto-install.'; return $false }

    $tool = $ToolMap[$name]
    Step "Attempting to install $($tool.Friendly) via winget ($($tool.ID))..."
    & winget install --id $($tool.ID) --accept-source-agreements --accept-package-agreements -e --silent
    if ($LASTEXITCODE -eq 0) {
      Ok "$($tool.Friendly) installed successfully."
      # Refresh path for the current session if possible
      $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
      return (Has $name)
    }
    Warn "Failed to install $($tool.Friendly) via winget."
    return $false
  }

  # Sequential gate. On miss in strict mode we throw immediately; the
  # script that called us prints nothing further about other tools.
  function Require($name, $hint) {
    if (Has $name) { Ok "$name found"; return }
    if (Try-Install $name) { return }

    if ($strict) {
      Err "MISSING: $name"
      Err "  fix: $hint"
      Err 'Refusing to continue - install the requirement and re-run.'
      throw "Required tool '$name' not found."
    } else {
      Warn "missing: $name ($hint) - continuing in soft mode"
    }
  }

  $modeLabel = if ($AutoInstall) { 'auto-install' } elseif ($strict) { 'strict' } else { 'soft' }
  Step "Verifying requirements (profile: $Profile, mode: $modeLabel)"

  $report = @{
    profile      = $Profile
    strict       = $strict
    cxxKind      = $null
    docker       = $false
    dockerDaemon = $false
  }

  # --- minimal ----------------------------------------------------------------
  Require 'node' 'install Node.js - https://nodejs.org'
  Require 'npm'  'reinstall Node.js (npm ships with it)'

  # --- dev / pods / full ------------------------------------------------------
  if ($Profile -in @('dev','pods','full')) {
    Require 'cmake' 'install CMake - https://cmake.org/download'
    if     (Has 'g++')     { Ok 'g++ found';       $report.cxxKind = 'g++' }
    elseif (Has 'clang++') { Ok 'clang++ found';   $report.cxxKind = 'clang++' }
    elseif (Has 'cl')      { Ok 'MSVC cl.exe found'; $report.cxxKind = 'cl' }
    else {
      if ($strict) {
        Err 'MISSING: g++ / clang++ / cl (C++17 compiler)'
        Err '  fix: install Visual Studio Build Tools (MSVC) or MSYS2 (g++)'
        Err 'Refusing to continue - install a C++17 compiler and re-run.'
        throw 'No C++17 compiler found.'
      } else {
        Warn 'missing: C++17 compiler - continuing in soft mode'
      }
    }
  }

  # --- pods -------------------------------------------------------------------
  if ($Profile -in @('pods','full')) {
    Require 'docker' 'install Docker Desktop - https://www.docker.com/products/docker-desktop'
    $report.docker = $true

    # Quick daemon probe — direct invocation, no temp files (mirrors bootstrap_and_deploy.ps1).
    function Invoke-DockerInfoProbe {
      & docker info *> $null
      return ($LASTEXITCODE -eq 0)
    }

    if (Invoke-DockerInfoProbe) {
      $report.dockerDaemon = $true
      Ok 'docker daemon responding'
    } else {
      # Docker Desktop implementation — detect the Desktop exe and auto-start it if not
      # already running, then poll every 3 s until the daemon is ready (up to 180 s).
      $desktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
      if (Test-Path $desktopExe) {
        $alreadyRunning = [bool](Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)
        if ($alreadyRunning) {
          Step 'Docker Desktop is already starting — waiting for daemon (up to 180 s)...'
        } else {
          Step 'docker daemon not running — launching Docker Desktop and waiting (up to 180 s)...'
          Start-Process -FilePath $desktopExe | Out-Null
        }
        $deadline = (Get-Date).AddSeconds(180)
        $ready    = $false
        while ((Get-Date) -lt $deadline) {
          if (Invoke-DockerInfoProbe) { $ready = $true; break }
          Start-Sleep -Seconds 3
        }
        if ($ready) {
          $report.dockerDaemon = $true
          Ok 'docker daemon responding (started via Docker Desktop)'
        } else {
          if ($strict) {
            Err 'Docker Desktop was launched but the daemon did not respond within 180 s.'
            Err '  fix: wait for the whale icon to turn solid, then re-run.'
            throw 'Docker daemon not responding after Docker Desktop launch.'
          } else {
            Warn 'docker daemon not ready after Docker Desktop launch - continuing in soft mode'
          }
        }
      } else {
        if ($strict) {
          Err 'MISSING: docker daemon (docker is installed but the daemon is not running)'
          Err '  fix: open Docker Desktop and wait for the whale icon to turn solid'
          Err 'Refusing to continue - start the Docker daemon and re-run.'
          throw 'Docker daemon not responding.'
        } else {
          Warn 'docker daemon not responding - continuing in soft mode'
        }
      }
    }
  }

  # --- full -------------------------------------------------------------------
  if ($Profile -eq 'full') {
    Require 'git' 'install git - https://git-scm.com'
  }

  Ok 'All requirements satisfied.'
  return $report
}

# Auto-invoke when run directly (not dot-sourced).
if ($MyInvocation.InvocationName -ne '.') {
  Test-Requirements -Profile $Profile -Soft:$Soft
}
