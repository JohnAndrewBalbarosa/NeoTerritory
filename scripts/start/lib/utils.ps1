# Tiny utilities used by dev/setup.

function Free-Port($port) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    Write-Warn "Port $port already in use by PID $($listener.OwningProcess) -- killing it."
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

function Wait-Url($url, $label, $tries = 120) {
  for ($i = 0; $i -lt $tries; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
  }
  Write-Warn "$label did not respond at $url after $tries tries."
  return $false
}
