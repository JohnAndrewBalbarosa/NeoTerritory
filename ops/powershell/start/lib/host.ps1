# LAN / host resolution.

function Get-LanIp {
  try {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -ne '127.0.0.1' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.IPAddress -notlike '192.168.56.*' -and   # VirtualBox host-only
        $_.IPAddress -notlike '192.168.99.*' -and   # Docker toolbox
        $_.PrefixOrigin -ne 'WellKnown' -and
        ($_.InterfaceAlias -match 'Wi-?Fi' -or $_.InterfaceAlias -match 'Ethernet') -and
        $_.InterfaceAlias -notmatch 'Virtual|vEthernet|VirtualBox|Hyper-V|WSL|Loopback'
      }
    # Prefer Wi-Fi over Ethernet
    $ip = ($candidates | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi' } | Select-Object -First 1)
    if (-not $ip) { $ip = ($candidates | Select-Object -First 1) }
    if ($ip) { return $ip.IPAddress }
    return $null
  } catch { return $null }
}

function Resolve-BindHost {
  if ($BindHost) { return $BindHost }
  if ($Lan)      { return '0.0.0.0' }
  return '127.0.0.1'
}

function Resolve-AdvertiseHost {
  # Address printed to the user / used by clean-browser when -Lan.
  if ($BindHost -and $BindHost -ne '0.0.0.0') { return $BindHost }
  if ($Lan) {
    $ip = Get-LanIp
    if ($ip) { return $ip }
    Write-Warn 'Could not detect a LAN IPv4 address -- falling back to localhost for the printed URL.'
  }
  return 'localhost'
}
