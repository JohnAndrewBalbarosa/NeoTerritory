# Post-deploy public-URL probe. Retries up to 12 times at 5 s intervals.

function Test-PublicUrl {
  param([string]$PublicUrl)
  Write-Host "-- Probing $PublicUrl from this laptop (waits up to 60s) --"
  for ($i = 1; $i -le 12; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri "$PublicUrl/" -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
      if ($resp.StatusCode -in 200,204,301,302,304) {
        Write-Host "   HTTP $($resp.StatusCode) on attempt $i"
        return $true
      }
    } catch {
      $msg = $_.Exception.Message.Split("`n")[0]
      Write-Host "  [..] attempt ${i}: $msg (retrying in 5s)"
    }
    Start-Sleep -Seconds 5
  }
  return $false
}

function Get-PublicUrl {
  if ($env:AWS_HOST_PORT -eq '80') { return "http://$($env:AWS_HOST)" }
  return "http://$($env:AWS_HOST):$($env:AWS_HOST_PORT)"
}
