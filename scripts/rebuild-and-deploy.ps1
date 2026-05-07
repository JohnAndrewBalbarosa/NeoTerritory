# PowerShell wrapper around scripts/rebuild-and-deploy.sh.
# Invokes the bash script inside WSL Ubuntu so Windows users get a one-liner.
#
# Usage:
#   .\scripts\rebuild-and-deploy.ps1
#   .\scripts\rebuild-and-deploy.ps1 -SkipCpp
#   .\scripts\rebuild-and-deploy.ps1 -SkipDocker
#   .\scripts\rebuild-and-deploy.ps1 -SkipCpp -SkipDocker  # restart only

param(
    [switch]$SkipCpp,
    [switch]$SkipDocker
)

$flags = @()
if ($SkipCpp)    { $flags += '--skip-cpp' }
if ($SkipDocker) { $flags += '--skip-docker' }
$flagStr = $flags -join ' '

$script = '/mnt/c/Users/Drew/Desktop/NeoTerritory/scripts/rebuild-and-deploy.sh'
$cmd    = "$script $flagStr"

Write-Host "[rebuild-and-deploy.ps1] running in WSL Ubuntu: $cmd"
wsl -d Ubuntu -- bash -c $cmd
