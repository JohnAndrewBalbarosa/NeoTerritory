# NeoTerritory — shared requirements verifier (PowerShell side).
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
    [switch]$Soft
  )

  $strict = -not $Soft

  function Has($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
  function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
  function Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
  function Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
  function Err($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

  # Sequential gate. On miss in strict mode we throw immediately; the
  # script that called us prints nothing further about other tools.
  function Require($name, $hint) {
    if (Has $name) { Ok "$name found"; return }
    if ($strict) {
      Err "MISSING: $name"
      Err "  fix: $hint"
      Err 'Refusing to continue — install the requirement and re-run.'
      throw "Required tool '$name' not found."
    } else {
      Warn "missing: $name ($hint) — continuing in soft mode"
    }
  }

  $modeLabel = if ($strict) { 'strict' } else { 'soft' }
  Step "Verifying requirements (profile: $Profile, mode: $modeLabel)"

  $report = @{
    profile      = $Profile
    strict       = $strict
    cxxKind      = $null
    docker       = $false
    dockerDaemon = $false
  }

  # --- minimal ----------------------------------------------------------------
  Require 'node' 'install Node.js — https://nodejs.org'
  Require 'npm'  'reinstall Node.js (npm ships with it)'

  # --- dev / pods / full ------------------------------------------------------
  if ($Profile -in @('dev','pods','full')) {
    Require 'cmake' 'install CMake — https://cmake.org/download'
    if     (Has 'g++')     { Ok 'g++ found';       $report.cxxKind = 'g++' }
    elseif (Has 'clang++') { Ok 'clang++ found';   $report.cxxKind = 'clang++' }
    elseif (Has 'cl')      { Ok 'MSVC cl.exe found'; $report.cxxKind = 'cl' }
    else {
      if ($strict) {
        Err 'MISSING: g++ / clang++ / cl (C++17 compiler)'
        Err '  fix: install Visual Studio Build Tools (MSVC) or MSYS2 (g++)'
        Err 'Refusing to continue — install a C++17 compiler and re-run.'
        throw 'No C++17 compiler found.'
      } else {
        Warn 'missing: C++17 compiler — continuing in soft mode'
      }
    }
  }

  # --- pods -------------------------------------------------------------------
  if ($Profile -in @('pods','full')) {
    Require 'docker' 'install Docker Desktop — https://www.docker.com/products/docker-desktop'
    $report.docker = $true

    # Daemon probe — `docker info` exits non-zero when Desktop is closed.
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
      $proc = Start-Process -FilePath 'docker' -ArgumentList 'info','--format','{{.ServerVersion}}' `
                -NoNewWindow -PassThru -RedirectStandardOutput $tmp -RedirectStandardError $tmp
      $proc.WaitForExit(5000) | Out-Null
      if ($proc.HasExited -and $proc.ExitCode -eq 0) {
        $report.dockerDaemon = $true
        Ok 'docker daemon responding'
      } else {
        try { $proc.Kill() } catch { }
        if ($strict) {
          Err 'MISSING: docker daemon (docker is installed but the daemon is not running)'
          Err '  fix: open Docker Desktop and wait for the whale icon to turn solid'
          Err 'Refusing to continue — start the Docker daemon and re-run.'
          throw 'Docker daemon not responding.'
        } else {
          Warn 'docker daemon not responding — continuing in soft mode'
        }
      }
    } finally {
      Remove-Item -ErrorAction SilentlyContinue -Path $tmp
    }
  }

  # --- full -------------------------------------------------------------------
  if ($Profile -eq 'full') {
    Require 'git' 'install git — https://git-scm.com'
  }

  Ok 'All requirements satisfied.'
  return $report
}
