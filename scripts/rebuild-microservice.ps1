# PowerShell wrapper for rebuild-microservice.sh.
# Use this when only C++ source changed and you need to refresh the
# microservice binary inside the existing container WITHOUT rebuilding
# the full Docker image (faster iteration during C++ debugging).
#
# Note: the running container holds the OLD binary; for changes to take
# effect you still need to rebuild + restart Docker via:
#   .\scripts\rebuild-and-deploy.ps1
#
# This script is mostly for verifying that the C++ side compiles cleanly
# before committing to a full Docker rebuild.

$script = '/mnt/c/Users/Drew/Desktop/NeoTerritory/scripts/rebuild-microservice.sh'
Write-Host "[rebuild-microservice.ps1] running in WSL Ubuntu"
wsl -d Ubuntu -- bash -c $script
