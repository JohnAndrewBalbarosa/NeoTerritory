# `start.ps1 browser` — clean Chromium launcher (replaces clean-browser.ps1).

function Invoke-Browser {
  param([string]$OverrideUrl = '')

  $target = if ($OverrideUrl) { $OverrideUrl }
            elseif ($Url)      { $Url }
            else {
              $advert = Resolve-AdvertiseHost
              "http://${advert}:$FrontendPort"
            }

  $chrome = Find-Chrome
  if (-not $chrome) { Write-Err 'No Chrome/Chromium found. Install Chrome or run: npx playwright install chromium'; exit 1 }

  Write-Host "Browser : $chrome"
  Write-Host "URL     : $target"

  $profileDir = Join-Path $env:TEMP ('clean-chrome-' + [System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $profileDir | Out-Null
  Write-Host "Profile : $profileDir  (deleted on exit)"

  $chromeArgs = Get-CleanChromeArgs -ProfileDir $profileDir -Target $target

  if ($OverrideUrl) {
    # Fire-and-forget: dev mode launches and continues tailing logs.
    Start-Process -FilePath $chrome -ArgumentList $chromeArgs | Out-Null
    return
  }

  try {
    $proc = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru
    $proc.WaitForExit()
  } finally {
    Remove-Item -Recurse -Force -Path $profileDir -ErrorAction SilentlyContinue
    Write-Host 'Profile cleaned up.'
  }
}

function Find-Chrome {
  $chrome = $null
  if ($Playwright -or -not $UseChrome) {
    $pwBase = "$env:LOCALAPPDATA\ms-playwright"
    $builds = Get-ChildItem -Path $pwBase -Filter 'chromium-*' -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name | Select-Object -Last 1
    if ($builds) {
      foreach ($sub in @('chrome-win64\chrome.exe','chrome-win\chrome.exe')) {
        $candidate = Join-Path $builds.FullName $sub
        if (Test-Path $candidate) { $chrome = $candidate; break }
      }
    }
  }
  if (-not $chrome) {
    foreach ($c in @(
      'C:\Program Files\Google\Chrome\Application\chrome.exe',
      'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
      'C:\Program Files\Chromium\Application\chrome.exe'
    )) { if (Test-Path $c) { $chrome = $c; break } }
  }
  return $chrome
}

function Get-CleanChromeArgs {
  param([string]$ProfileDir, [string]$Target)
  return @(
    "--user-data-dir=$ProfileDir",
    '--no-first-run','--no-default-browser-check','--disable-extensions','--disable-default-apps',
    '--disable-sync','--disable-translate','--disable-background-networking',
    '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows',
    '--disable-client-side-phishing-detection','--disable-component-update','--disable-hang-monitor',
    '--disable-ipc-flooding-protection','--disable-popup-blocking','--disable-prompt-on-repost',
    '--disable-renderer-backgrounding','--disk-cache-size=0','--media-cache-size=0',
    '--disable-application-cache','--password-store=basic','--use-mock-keychain',
    '--metrics-recording-only','--safebrowsing-disable-auto-update','--incognito',
    $Target
  )
}
