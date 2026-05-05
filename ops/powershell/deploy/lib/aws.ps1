# AWS CLI readiness + Lightsail public-firewall opener.

function Ensure-AwsReady {
  param([string]$ScriptRoot)
  if (-not $env:AWS_LIGHTSAIL_INSTANCE_NAME) { return $true }

  $awsExe = Get-Command aws -ErrorAction SilentlyContinue
  if (-not $awsExe) {
    Write-Host 'i AWS CLI not found. Attempting auto-install...' -ForegroundColor Cyan
    . (Join-Path $ScriptRoot 'verify-requirements.ps1')
    try { Test-Requirements -Profile minimal -AutoInstall -Soft | Out-Null } catch { }
    $awsExe = Get-Command aws -ErrorAction SilentlyContinue
    if (-not $awsExe) {
      Write-Warning 'Auto-install failed. Please install AWS CLI manually.'
      return $false
    }
  }

  & aws sts get-caller-identity *> $null
  if ($LASTEXITCODE -eq 0) { return $true }

  Write-Warning 'AWS CLI is installed but NOT configured (no credentials found).'
  $response = Read-Host "Would you like to run 'aws configure' now? [y/N]"
  if ($response -notmatch '^[yY]') {
    Write-Host 'i Skipping AWS configuration. Firewall auto-open will be skipped.' -ForegroundColor Yellow
    return $false
  }
  Start-Process 'aws' -ArgumentList 'configure' -Wait
  & aws sts get-caller-identity *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'AWS configuration failed or was cancelled. Firewall auto-open will be skipped.'
    return $false
  }
  Write-Host 'AWS CLI configured successfully.' -ForegroundColor Green
  return $true
}

function Open-LightsailPorts {
  param([string]$ScriptRoot, [switch]$DryRun)
  if (-not $env:AWS_LIGHTSAIL_INSTANCE_NAME) {
    Write-Host 'i AWS_LIGHTSAIL_INSTANCE_NAME not set - skipping auto port-open.'
    Write-Host '  Lightsail console -> Instance -> Networking -> IPv4 Firewall -> Add HTTP/80 and HTTPS/443'
    return
  }
  if (-not (Ensure-AwsReady -ScriptRoot $ScriptRoot)) {
    Write-Host 'i Skipping auto port-open due to AWS CLI setup issues.' -ForegroundColor Yellow
    return
  }
  $region = if ($env:AWS_LIGHTSAIL_REGION) { $env:AWS_LIGHTSAIL_REGION } else { 'ap-southeast-1' }
  Write-Host "-- Opening Lightsail public ports 22, 80, 443 on '$($env:AWS_LIGHTSAIL_INSTANCE_NAME)' ($region) --"
  if ($DryRun) { return }
  & aws lightsail put-instance-public-ports `
    --region $region `
    --instance-name $env:AWS_LIGHTSAIL_INSTANCE_NAME `
    --port-infos 'fromPort=22,toPort=22,protocol=tcp' `
                 'fromPort=80,toPort=80,protocol=tcp' `
                 'fromPort=443,toPort=443,protocol=tcp' 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host '  Lightsail firewall now allows 22, 80, 443' }
  else { Write-Warning 'put-instance-public-ports failed - open the ports manually in the console' }
}
