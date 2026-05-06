# Build the remote env file content and (re)start the container on AWS.

function Build-RemoteEnvLines {
  param([bool]$UseSupabase)
  $lines = @('PORT=3001','NODE_ENV=production')
  if ($env:CORS_ORIGIN) {
    $lines += "CORS_ORIGIN=$($env:CORS_ORIGIN)"
  } elseif ($env:AWS_HOST_PORT -eq '80') {
    $lines += "CORS_ORIGIN=http://$($env:AWS_HOST)"
  } else {
    $lines += "CORS_ORIGIN=http://$($env:AWS_HOST):$($env:AWS_HOST_PORT)"
  }
  foreach ($k in 'JWT_SECRET','GEMINI_API_KEY','GEMINI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL','AI_PROVIDER','ADMIN_USERNAME','ADMIN_PASSWORD','TEST_RUNNER_USE_DOCKER','ENABLE_TEST_RUNNER','TEST_RUNNER_SANDBOX') {
    $v = (Get-Item "Env:$k" -ErrorAction SilentlyContinue).Value
    if ($v) { $lines += "$k=$v" }
  }
  if ($UseSupabase -and $env:SUPABASE_URL -and $env:SUPABASE_SERVICE_KEY) {
    $lines += "SUPABASE_URL=$($env:SUPABASE_URL)"
    $lines += "SUPABASE_SERVICE_KEY=$($env:SUPABASE_SERVICE_KEY)"
    if ($env:SUPABASE_LOGS_TABLE)  { $lines += "SUPABASE_LOGS_TABLE=$($env:SUPABASE_LOGS_TABLE)" }
    if ($env:SUPABASE_AUDIT_TABLE) { $lines += "SUPABASE_AUDIT_TABLE=$($env:SUPABASE_AUDIT_TABLE)" }
    Write-Host "Supabase mirror enabled (admin/audit logs -> $($env:SUPABASE_URL))"
  } else {
    Write-Host 'i Supabase mirror disabled - container will use local SQLite only'
  }
  return ,$lines
}

function Restart-RemoteContainer {
  param(
    [string]$SshOpts, [string]$SshTarget, [string]$ImageRef,
    [bool]$UseSupabase, [switch]$DryRun
  )
  $envLines = Build-RemoteEnvLines -UseSupabase $UseSupabase
  $remoteEnv = "/tmp/$($env:CONTAINER_NAME).env.$PID"

  if ($DryRun) {
    Write-Host "-> scp env to $remoteEnv ; ssh restart container"
    return
  }

  $localTmp = New-TemporaryFile
  try {
    Set-Content -Path $localTmp.FullName -Value ($envLines -join "`n") -Encoding ascii -NoNewline
    Invoke-Expression "scp $SshOpts `"$($localTmp.FullName)`" `"$($SshTarget):$remoteEnv`""
  } finally { Remove-Item $localTmp.FullName -Force -ErrorAction SilentlyContinue }

  $remoteScript = @"
set -e
docker rm -f "$($env:CONTAINER_NAME)" 2>/dev/null || true
docker run -d \
  --name "$($env:CONTAINER_NAME)" \
  --restart unless-stopped \
  -p $($env:AWS_HOST_PORT):3001 \
  --env-file "$remoteEnv" \
  -v $($env:CONTAINER_NAME)-data:/app/Codebase/Backend/src/db \
  "$ImageRef"
shred -u "$remoteEnv" 2>/dev/null || rm -f "$remoteEnv"
docker ps --filter "name=$($env:CONTAINER_NAME)"
"@
  $remoteScript | & ssh $SshOpts.Split(' ') $SshTarget 'bash -s'
}
