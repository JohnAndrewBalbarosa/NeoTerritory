# DEPRECATED SHIM — forwards to scripts/rebuild.ps1.
#
# Canonical entry is scripts/rebuild.ps1 (or `./start.ps1 rebuild`).
# Flag mapping for backwards compatibility:
#   -SkipCpp    → -SkipMicroservice
#   -SkipDocker → -SkipDocker

param(
    [switch]$SkipCpp,
    [switch]$SkipDocker
)

$forwarded = @()
if ($SkipCpp)    { $forwarded += '-SkipMicroservice' }
if ($SkipDocker) { $forwarded += '-SkipDocker' }

Write-Host "[rebuild-and-deploy.ps1] DEPRECATED: forwarding to scripts/rebuild.ps1 $($forwarded -join ' ')"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$here/rebuild.ps1" @forwarded
