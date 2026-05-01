# Launch a completely isolated Chromium with no cache, no cookies, no history.
# Each run gets a fresh temp profile that is deleted when the browser closes.
#
# Usage:
#   .\clean-browser.ps1
#   .\clean-browser.ps1 http://localhost:5173
#   .\clean-browser.ps1 -Playwright
#   .\clean-browser.ps1 -Playwright http://localhost:3001

param(
  [string]$Url = "http://localhost:3001",
  [switch]$Playwright
)

# ── pick binary ──────────────────────────────────────────────────────────────

$chrome = $null

if ($Playwright) {
  $pwBase = "$env:LOCALAPPDATA\ms-playwright"
  $builds = Get-ChildItem -Path $pwBase -Filter "chromium-*" -Directory -ErrorAction SilentlyContinue `
    | Sort-Object Name | Select-Object -Last 1
  if ($builds) {
    foreach ($sub in @("chrome-win64\chrome.exe", "chrome-win\chrome.exe")) {
      $candidate = Join-Path $builds.FullName $sub
      if (Test-Path $candidate) { $chrome = $candidate; break }
    }
  }
  if (-not $chrome) {
    Write-Error "No Playwright Chromium found. Run: npx playwright install chromium"
    exit 1
  }
} else {
  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Chromium\Application\chrome.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $chrome = $c; break }
  }
}

if (-not $chrome) {
  Write-Error "No Chrome/Chromium found. Install it or run with -Playwright."
  exit 1
}

Write-Host "Browser : $chrome"
Write-Host "URL     : $Url"

# ── fresh temp profile ────────────────────────────────────────────────────────

$profileDir = Join-Path $env:TEMP ("clean-chrome-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $profileDir | Out-Null
Write-Host "Profile : $profileDir  (deleted on exit)"

# ── launch and wait ──────────────────────────────────────────────────────────

$args = @(
  "--user-data-dir=$profileDir",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-default-apps",
  "--disable-sync",
  "--disable-translate",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-popup-blocking",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--disk-cache-size=0",
  "--media-cache-size=0",
  "--disable-application-cache",
  "--password-store=basic",
  "--use-mock-keychain",
  "--metrics-recording-only",
  "--safebrowsing-disable-auto-update",
  "--incognito",
  $Url
)

try {
  $proc = Start-Process -FilePath $chrome -ArgumentList $args -PassThru
  $proc.WaitForExit()
} finally {
  Remove-Item -Recurse -Force -Path $profileDir -ErrorAction SilentlyContinue
  Write-Host "Profile cleaned up."
}
