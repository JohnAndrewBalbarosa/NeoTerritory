# NeoTerritory — shared requirements verifier.
#
# Sourced by start.ps1, run-dev.ps1, deploy.ps1, etc. via dot-sourcing:
#     . "$PSScriptRoot\scripts\verify-requirements.ps1"
#     Test-Requirements -Profile dev
#
# Profiles:
#   minimal     node, npm
#   dev         minimal + cmake + a C++17 compiler
#   pods        dev + docker on PATH + docker daemon responding
#   full        pods + git
#
# Returns a hashtable describing what was found / missing. Throws when a
# required tool for the requested profile is absent. Use -Soft to log the
# misses instead of throwing — useful for "build the image if Docker is
# up, otherwise carry on with the local sandbox" scripts.

function Test-Requirements {
  param(
    [ValidateSet('minimal','dev','pods','full')]
    [string]$Profile = 'dev',
    [switch]$Soft
  )

  function Has($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
  function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
  function Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
  function Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
  function Err($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

  Step "Verifying requirements (profile: $Profile)"

  $report = @{
    profile      = $Profile
    node         = $false
    npm          = $false
    cmake        = $false
    cxx          = $false
    cxxKind      = $null
    docker       = $false
    dockerDaemon = $false
    git          = $false
    missing      = @()
  }

  # --- minimal ----------------------------------------------------------------

  if (Has 'node') { $report.node = $true; Ok "node $((node --version) 2>&1)" }
  else            { $report.missing += 'node (https://nodejs.org)'; Err 'node not found' }

  if (Has 'npm')  { $report.npm = $true; Ok "npm $((npm --version) 2>&1)" }
  else            { $report.missing += 'npm (bundled with node)'; Err 'npm not found' }

  # --- dev / pods / full ------------------------------------------------------

  if ($Profile -in @('dev','pods','full')) {
    if (Has 'cmake') { $report.cmake = $true; Ok "cmake present" }
    else             { $report.missing += 'cmake (https://cmake.org)'; Err 'cmake not found' }

    if (Has 'g++')        { $report.cxx = $true; $report.cxxKind = 'g++';     Ok 'g++ found' }
    elseif (Has 'clang++'){ $report.cxx = $true; $report.cxxKind = 'clang++'; Ok 'clang++ found' }
    elseif (Has 'cl')     { $report.cxx = $true; $report.cxxKind = 'cl';      Ok 'MSVC cl.exe found' }
    else                  { $report.missing += 'a C++17 compiler (g++ / clang++ / MSVC cl)'; Err 'no C++17 compiler found' }
  }

  # --- pods -------------------------------------------------------------------

  if ($Profile -in @('pods','full')) {
    if (Has 'docker') {
      $report.docker = $true
      Ok 'docker on PATH'
      # Daemon probe — `docker info` exits non-zero when Desktop is closed.
      # Use a temp file for stdout/stderr capture; Start-Process's
      # -RedirectStandard* params require real paths, not NUL.
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
          Warn 'docker daemon not responding (start Docker Desktop)'
          if (-not $Soft) { $report.missing += 'docker daemon (open Docker Desktop)' }
        }
      } finally {
        Remove-Item -ErrorAction SilentlyContinue -Path $tmp
      }
    } else {
      Warn 'docker not on PATH (per-user pod isolation will fall back to local sandbox)'
      if (-not $Soft) { $report.missing += 'docker (https://www.docker.com/products/docker-desktop)' }
    }
  }

  # --- full -------------------------------------------------------------------

  if ($Profile -eq 'full') {
    if (Has 'git') { $report.git = $true; Ok 'git found' }
    else           { $report.missing += 'git'; Err 'git not found' }
  }

  if ($report.missing.Count -gt 0 -and -not $Soft) {
    Err ''
    Err 'Missing requirements:'
    $report.missing | ForEach-Object { Err "  - $_" }
    throw "Requirements check failed for profile '$Profile'."
  } elseif ($report.missing.Count -gt 0) {
    Warn 'Some optional requirements are missing — continuing in degraded mode.'
  } else {
    Ok 'All requirements satisfied.'
  }

  return $report
}
