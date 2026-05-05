# `start.ps1 deploy` — thin wrapper around scripts/deploy-aws.ps1.

function Invoke-Deploy {
  $deployScript = Join-Path $Root 'scripts\deploy-aws.ps1'
  if (-not (Test-Path $deployScript)) { Write-Err "Deploy script not found: $deployScript"; exit 1 }
  & $deployScript @Rest
}
