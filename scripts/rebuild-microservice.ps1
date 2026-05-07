# DEPRECATED SHIM — forwards to scripts/rebuild.ps1 with C++-only exclusions.
#
# Canonical: .\scripts\rebuild.ps1 -SkipFrontend -SkipBackend -SkipDocker

Write-Host "[rebuild-microservice.ps1] DEPRECATED: forwarding to scripts/rebuild.ps1 -SkipFrontend -SkipBackend -SkipDocker"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$here/rebuild.ps1" -SkipFrontend -SkipBackend -SkipDocker
