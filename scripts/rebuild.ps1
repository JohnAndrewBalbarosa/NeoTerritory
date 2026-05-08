# scripts/rebuild.ps1 — PowerShell wrapper around scripts/rebuild.sh.
#
# Default (no flags): full local rebuild of all four layers + container on :3001.
# Flags are EXCLUSIONS — anything you pass is what gets skipped.
#
# Usage:
#   .\scripts\rebuild.ps1
#   .\scripts\rebuild.ps1 -SkipMicroservice
#   .\scripts\rebuild.ps1 -SkipFrontend -SkipBackend
#   .\scripts\rebuild.ps1 -SkipDocker            # cmake build only
#   .\scripts\rebuild.ps1 -ModeA                 # rebuild then hot-reload
#
# Mirrors scripts/rebuild.sh exactly — this script just forwards into WSL.

param(
    [switch]$SkipMicroservice,
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$SkipDocker,
    [switch]$ModeA,
    [switch]$Help
)

$flags = @()
if ($SkipMicroservice) { $flags += '--skip-microservice' }
if ($SkipFrontend)     { $flags += '--skip-frontend' }
if ($SkipBackend)      { $flags += '--skip-backend' }
if ($SkipDocker)       { $flags += '--skip-docker' }
if ($ModeA)            { $flags += '--mode-a' }
if ($Help)             { $flags += '--help' }
$flagStr = $flags -join ' '

$script = '/mnt/c/Users/Drew/Desktop/NeoTerritory/scripts/rebuild.sh'
$cmd    = "$script $flagStr".TrimEnd()

Write-Host "[rebuild.ps1] running in WSL Ubuntu: $cmd"
wsl -d Ubuntu -- bash -c $cmd
