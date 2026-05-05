# NeoTerritory -- single root entry (Windows side).
#
# Replaces: bootstrap.ps1, deploy.ps1, run-dev.ps1, setup.cmd,
#           setup.ps1 (k8s), clean-browser.ps1.
# See docs/Codebase/DESIGN_DECISIONS.md (D28).
#
# Usage:
#   .\start.ps1 -Local                       # Local computer deployment (dev)
#   .\start.ps1 -Aws                         # AWS Lightsail deployment only
#   .\start.ps1 -Both                        # Both local and AWS deployment
#   .\start.ps1 -Lan                         # dev, exposed to LAN
# .\start.ps1 -BindHost [IP_ADDRESS]        # bind to exact IP
#   .\start.ps1 dev -Lan -BackendPort 4000
#   .\start.ps1 setup                        # first-time provision (was bootstrap.ps1)
#   .\start.ps1 setup -Mode full -Lan        # unattended full provision (was deploy.ps1)
#   .\start.ps1 k8s                          # minikube/kubectl (was setup.ps1)
#   .\start.ps1 browser -Lan                 # clean Chromium (was clean-browser.ps1)
#   .\start.ps1 test -Users 5                # k8s multi-user sim (was test.sh)
#   .\start.ps1 deploy --source              # AWS ship-to-cloud (was deploy-aws.ps1)

param(
  [Parameter(Position = 0)]
  [ValidateSet('dev','prod','setup','k8s','browser','test','deploy','')]
  [string]$Command = 'dev',

  # Universal
  [switch]$Lan,
  [string]$BindHost = '',
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 5173,
  [switch]$Deploy,
  [switch]$Local,
  [switch]$Aws,
  [switch]$Both,

  # dev
  [switch]$Rebuild,
  [switch]$BackendOnly,
  [switch]$NoBrowser,
  [switch]$SkipPod,
  [switch]$UseChrome,
  [switch]$Prod,
  [switch]$SkipBuild,

  # setup
  [ValidateSet('dev','full')][string]$Mode = 'dev',
  [switch]$SkipMicroservice,
  [switch]$AutoStart,
  [string]$AnthropicKey = '',
  [string]$AnthropicModel = 'claude-sonnet-4-6',

  # k8s
  [switch]$Reset,
  [switch]$LegacyWslToolsInstall,

  # browser
  [string]$Url = '',
  [switch]$Playwright,

  # test
  [int]$Users = 3,

  # passthrough
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Stop'
$Root         = $PSScriptRoot
$BackendDir   = Join-Path $Root 'Codebase\Backend'
$FrontendDir  = Join-Path $Root 'Codebase\Frontend'
$MicroserviceDir = Join-Path $Root 'Codebase\Microservice'
$BuildDir     = Join-Path $MicroserviceDir 'build'
$BinaryName   = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'NeoTerritory.exe' } else { 'NeoTerritory' }
$BinaryPath   = Join-Path $BuildDir $BinaryName
$EnvFile      = Join-Path $BackendDir '.env'
$Dockerfile   = Join-Path $Root 'Codebase\Infrastructure\session-orchestration\docker\Dockerfile'
$PodImage     = 'neoterritory/cpp-pod:latest'

# -- Output helpers ----------------------------------------------------------
function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [xx] $msg" -ForegroundColor Red }
function Test-Tool($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

# -- LAN / host resolution ---------------------------------------------------
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

# -- Tiny utilities ----------------------------------------------------------
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

function Write-DevEnv {
  param([int]$Port, [int]$VitePort, [string]$AdvertiseHost)
  if (Test-Path $EnvFile) {
    Write-Ok '.env already exists -- leaving in place.'
    return
  }
  Write-Step 'Creating Backend\.env with defaults'
  $cors = "http://localhost:$Port,http://localhost:$VitePort"
  if ($AdvertiseHost -ne 'localhost') {
    $cors += ",http://${AdvertiseHost}:$Port,http://${AdvertiseHost}:$VitePort"
  }
@"
PORT=$Port
CORS_ORIGIN=$cors
DB_PATH=./src/db/database.sqlite

# Anthropic Claude integration. Leave unset to run microservice-only mode.
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Microservice integration. Defaults derived from project layout.
# NEOTERRITORY_BIN=$BinaryPath
# NEOTERRITORY_CATALOG=$MicroserviceDir\pattern_catalog
"@ | Set-Content -Path $EnvFile -Encoding utf8
  Write-Ok ".env created at $EnvFile"
}

function Build-Microservice {
  param([switch]$Force)
  $needsBuild = $Force.IsPresent -or (-not (Test-Path $BinaryPath))
  if (-not $needsBuild) {
    Write-Ok "Microservice binary already built: $BinaryPath"
    return
  }
  Write-Step 'Building microservice (CMake)'
  if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir | Out-Null }
  $generator = $null
  if (Test-Tool 'mingw32-make') { $generator = 'MinGW Makefiles' }
  elseif (Test-Tool 'make')     { $generator = 'Unix Makefiles' }
  Push-Location $MicroserviceDir
  try {
    if ($generator) { & cmake -S . -B build -G $generator } else { & cmake -S . -B build }
    if ($LASTEXITCODE -ne 0) { throw 'cmake configure failed.' }
    & cmake --build build --parallel
    if ($LASTEXITCODE -ne 0) { throw 'cmake build failed.' }
  } finally { Pop-Location }
  Write-Ok "Microservice built: $BinaryPath"
}

function Ensure-NodeModules {
  param([string]$Dir, [string]$Label)
  $nm = Join-Path $Dir 'node_modules'
  if (Test-Path $nm) { Write-Ok "$Label node_modules already present."; return }
  Write-Step "Installing $Label npm dependencies"
  Push-Location $Dir
  try { & npm install } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Err "$Label npm install failed."; exit 1 }
  Write-Ok "$Label node_modules installed."
}

# -----------------------------------------------------------------------------
# Subcommand: dev  (replaces old start.ps1 + run-dev.ps1)
# -----------------------------------------------------------------------------
function Invoke-Dev {
  . (Join-Path $Root 'scripts\verify-requirements.ps1')
  $reqProfile = if ($SkipPod) { 'dev' } else { 'pods' }
  try { $report = Test-Requirements -Profile $reqProfile -AutoInstall }
  catch { Write-Err "Aborting -- requirements not met: $($_.Exception.Message)"; exit 1 }

  $bind     = Resolve-BindHost
  $advert   = Resolve-AdvertiseHost

  # Pod image (one-time host build)
  if (-not $SkipPod) {
    Write-Step 'Checking Docker pod image'
    if (-not $report.docker) {
      Write-Warn 'docker not on PATH -- pod isolation skipped; backend uses local sandbox.'
    } elseif (-not $report.dockerDaemon) {
      Write-Warn 'docker daemon not responding -- start Docker Desktop and re-run.'
    } else {
      $imageExists = $false
      try { & docker image inspect $PodImage *> $null; $imageExists = ($LASTEXITCODE -eq 0) } catch { }
      if (-not $imageExists) {
        if (Test-Path $Dockerfile) {
          Write-Step "Building $PodImage from $Dockerfile (one-time, ~30-60s)"
          & docker build -f $Dockerfile -t $PodImage $Root
          if ($LASTEXITCODE -ne 0) { Write-Warn 'docker build failed -- falling back to local sandbox.' }
          else { Write-Ok "$PodImage ready." }
        } else {
          Write-Warn "Dockerfile not found at $Dockerfile -- pod isolation unavailable."
        }
      } else {
        Write-Ok "$PodImage already built."
      }
    }
  }

  Ensure-NodeModules -Dir $BackendDir -Label 'Backend'
  if (-not $BackendOnly) { Ensure-NodeModules -Dir $FrontendDir -Label 'Frontend' }

  Write-DevEnv -Port $BackendPort -VitePort $FrontendPort -AdvertiseHost $advert
  Build-Microservice -Force:$Rebuild

  if ($Prod -and -not $SkipBuild) {
    Write-Step 'Building Backend (npm run build)'
    Push-Location $BackendDir
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' } } finally { Pop-Location }
    Write-Ok 'Backend build complete.'
    if (-not $BackendOnly) {
      Write-Step 'Building Frontend (npm run build)'
      Push-Location $FrontendDir
      try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
      Write-Ok 'Frontend build complete.'
    }
  }

  $backendScript = if ($Prod) { 'start' } else { 'dev' }
  $modeLabel     = if ($Prod) { 'prod' } else { 'dev' }

  # Backend
  Write-Step "Starting backend (bind=$bind, port=$BackendPort, mode=$modeLabel)"
  $env:PORT = "$BackendPort"
  $env:HOST = $bind
  if (($Lan -or $BindHost) -and $advert -ne 'localhost') {
    $env:CORS_ORIGIN = "http://localhost:$BackendPort,http://localhost:$FrontendPort,http://${advert}:$BackendPort,http://${advert}:$FrontendPort"
  }
  Free-Port $BackendPort
  $serverProc = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run',$backendScript) `
    -WorkingDirectory $BackendDir `
    -PassThru -NoNewWindow `
    -RedirectStandardOutput (Join-Path $BackendDir 'server.out.log') `
    -RedirectStandardError  (Join-Path $BackendDir 'server.err.log')

  if (-not (Wait-Url "http://127.0.0.1:$BackendPort/api/health" 'Backend' 60)) {
    Write-Err 'Backend did not become healthy within 30s. Last lines of server.err.log:'
    if (Test-Path (Join-Path $BackendDir 'server.err.log')) {
      Get-Content (Join-Path $BackendDir 'server.err.log') -Tail 30 | ForEach-Object { Write-Host "    $_" }
    }
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    exit 1
  }
  Write-Ok 'Backend healthy.'

  # Vite
  $viteProc = $null
  if (-not $BackendOnly) {
    $viteScript = if ($Prod) { 'preview' } else { 'dev' }
    $viteLabel  = if ($Prod) { 'Vite preview' } else { 'Vite dev server' }
    Write-Step "Starting $viteLabel (bind=$bind, port=$FrontendPort)"
    Free-Port $FrontendPort
    $env:VITE_HOST = $bind
    $viteCmdArgs = @('run',$viteScript,'--','--port',"$FrontendPort",'--strictPort')
    if ($bind -eq '0.0.0.0' -or $Lan) { $viteCmdArgs += @('--host','0.0.0.0') }
    elseif ($BindHost) { $viteCmdArgs += @('--host', $BindHost) }
    $viteProc = Start-Process -FilePath 'npm.cmd' `
      -ArgumentList $viteCmdArgs `
      -WorkingDirectory $FrontendDir `
      -PassThru -NoNewWindow `
      -RedirectStandardOutput (Join-Path $FrontendDir 'vite.out.log') `
      -RedirectStandardError  (Join-Path $FrontendDir 'vite.err.log')

    if (-not (Wait-Url "http://127.0.0.1:$FrontendPort/" 'Vite' 60)) {
      Write-Err 'Vite did not start within 30s. Last lines of vite.err.log:'
      if (Test-Path (Join-Path $FrontendDir 'vite.err.log')) {
        Get-Content (Join-Path $FrontendDir 'vite.err.log') -Tail 30 | ForEach-Object { Write-Host "    $_" }
      }
      Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
      Stop-Process -Id $viteProc.Id   -Force -ErrorAction SilentlyContinue
      exit 1
    }
    Write-Ok 'Vite ready.'
  }

  $studioPort = if ($BackendOnly) { $BackendPort } else { $FrontendPort }
  $localUrl   = "http://localhost:$studioPort"
  $lanUrl     = if ($advert -ne 'localhost') { "http://${advert}:$studioPort" } else { $null }
  $openUrl    = if ($lanUrl) { $lanUrl } else { $localUrl }

  Write-Host ''
  Write-Host "  Studio:        $localUrl" -ForegroundColor White
  if ($lanUrl) { Write-Host "  Studio (LAN):  $lanUrl"   -ForegroundColor White }
  Write-Host "  Backend API:   http://localhost:$BackendPort" -ForegroundColor White
  Write-Host "  Health:        http://localhost:$BackendPort/api/health" -ForegroundColor White
  Write-Host "  Backend PID:   $($serverProc.Id)" -ForegroundColor White
  if ($viteProc)  { Write-Host "  Vite PID:      $($viteProc.Id)" -ForegroundColor White }
  Write-Host ''
  Write-Host 'Ctrl+C stops the backend, Vite, and the browser.' -ForegroundColor Gray

  if (-not $NoBrowser) {
    Write-Step "Launching clean Chromium ($(if ($UseChrome) { 'Chrome' } else { 'Playwright' }))"
    Invoke-Browser -OverrideUrl $openUrl
  }

  try {
    Get-Content -Path (Join-Path $BackendDir 'server.out.log') -Wait -Tail 0
  } finally {
    Write-Host ''; Write-Step 'Shutting down'
    if ($serverProc -and -not $serverProc.HasExited) { Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue }
    if ($viteProc   -and -not $viteProc.HasExited)   { Stop-Process -Id $viteProc.Id   -Force -ErrorAction SilentlyContinue }
    Write-Ok 'Stopped.'
  }
}

# -----------------------------------------------------------------------------
# Subcommand: setup  (replaces bootstrap.ps1 + deploy.ps1 + setup.cmd)
# -----------------------------------------------------------------------------
function Invoke-Setup {
  Set-Location $Root
  $verifier = Join-Path $Root 'scripts\verify-requirements.ps1'
  if (Test-Path $verifier) {
    . $verifier
    try { Test-Requirements -Profile dev -AutoInstall | Out-Null }
    catch { Write-Err "Setup aborted -- requirements not met: $($_.Exception.Message)"; exit 1 }
  }

  Write-Step "Setup mode: $Mode"

  # Phase 2 -- Backend deps
  Write-Step 'Phase 2: Backend npm install'
  Push-Location $BackendDir
  try { & npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } } finally { Pop-Location }
  Write-Ok 'Backend dependencies installed.'

  # Phase 2b -- Frontend deps
  Write-Step 'Phase 2b: Frontend npm install'
  Push-Location $FrontendDir
  try { & npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } } finally { Pop-Location }
  Write-Ok 'Frontend dependencies installed.'

  # Phase 3 -- Microservice
  if (-not $SkipMicroservice) { Build-Microservice -Force:$false }

  # Phase 4 -- .env
  Write-Step 'Phase 4: Backend .env configuration'
  $advert = Resolve-AdvertiseHost
  $cors   = "http://localhost:$BackendPort"
  if ($advert -ne 'localhost') { $cors += ",http://${advert}:$BackendPort,http://${advert}:$FrontendPort" }
  $envLines = @(
    "PORT=$BackendPort",
    "CORS_ORIGIN=$cors",
    'DB_PATH=./src/db/database.sqlite',
    '',
    '# Anthropic Claude integration. Leave unset to run microservice-only mode.'
  )
  if ($AnthropicKey) {
    $envLines += "ANTHROPIC_API_KEY=$AnthropicKey"
    $envLines += "ANTHROPIC_MODEL=$AnthropicModel"
  } else {
    $envLines += '# ANTHROPIC_API_KEY=sk-ant-...'
    $envLines += "# ANTHROPIC_MODEL=$AnthropicModel"
  }
  $envLines += ''
  $envLines += '# Microservice integration.'
  $envLines += "NEOTERRITORY_BIN=$BinaryPath"
  $envLines += "NEOTERRITORY_CATALOG=$(Join-Path $MicroserviceDir 'pattern_catalog')"

  if (Test-Path $EnvFile) {
    $backupName = ".env.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $EnvFile (Join-Path $BackendDir $backupName)
    Write-Warn "Existing .env backed up to $backupName"
  }
  $envLines | Set-Content -Path $EnvFile -Encoding utf8
  Write-Ok ".env written at $EnvFile (port=$BackendPort, anthropic=$([bool]$AnthropicKey), lan=$($advert -ne 'localhost'))"

  # Phase 5 -- DB warm (full mode only)
  if ($Mode -eq 'full') {
    Write-Step 'Phase 5: Database warm-up'
    Push-Location $BackendDir
    try {
      & node -e "const { initDb } = require('./src/db/initDb'); initDb(); console.log('schema initialized');"
      if ($LASTEXITCODE -ne 0) { throw 'DB init failed.' }
      Write-Ok 'Database schema initialized.'
    } finally { Pop-Location }
  }

  Write-Host ''
  Write-Step 'Setup complete'
  Write-Ok "Project root:  $Root"
  Write-Ok "Studio UI:     http://localhost:$BackendPort (after start)"
  Write-Ok "Run dev with:  .\start.ps1$(if ($Lan) { ' -Lan' } else { '' })"
  if (-not $AnthropicKey) {
    Write-Warn 'No ANTHROPIC_API_KEY set -- AI documentation will return "pending_provider".'
  }

  if ($AutoStart) {
    Write-Host ''; Write-Step 'Starting dev server now (-AutoStart)'
    & $PSCommandPath dev -BackendPort $BackendPort -FrontendPort $FrontendPort `
        @(if ($Lan) { '-Lan' }) @(if ($BindHost) { @('-BindHost', $BindHost) })
  }
}

# -----------------------------------------------------------------------------
# Subcommand: k8s  (replaces old setup.ps1 -- minikube/kubectl)
# -----------------------------------------------------------------------------
function Invoke-K8s {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Write-Warn 'k8s mode needs Administrator. Re-launching elevated…'
    $argsList = @('-NoExit','-Command',"& '$PSCommandPath' k8s")
    if ($Reset) { $argsList += '-Reset' }
    if ($LegacyWslToolsInstall) { $argsList += '-LegacyWslToolsInstall' }
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argsList -Verb RunAs
    exit 0
  }
  Write-Ok 'Running with Administrator privileges.'

  if ($LegacyWslToolsInstall) {
    Write-Step 'Installing Minikube + kubectl in WSL (legacy path)'
    wsl bash -c 'curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64'
    wsl -u root bash -c 'install minikube-linux-amd64 /usr/local/bin/minikube'
    wsl bash -c 'rm minikube-linux-amd64'
    wsl bash -c 'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"'
    wsl -u root bash -c 'install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl'
    wsl bash -c 'rm kubectl'
    Write-Ok 'WSL tool installation complete.'
    return
  }

  $bootstrapScript = Join-Path $Root 'Codebase\Infrastructure\session-orchestration\bootstrap_and_deploy.ps1'
  if (-not (Test-Path $bootstrapScript)) { throw "Bootstrap script not found: $bootstrapScript" }

  if ($Reset) {
    Write-Step 'Tearing down minikube before re-deploy'
    & minikube delete 2>$null | Out-Null
  }

  & $bootstrapScript
  if (Get-Variable -Name LASTEXITCODE -Scope Global -ErrorAction SilentlyContinue) {
    exit $global:LASTEXITCODE
  }
}

# -----------------------------------------------------------------------------
# Subcommand: browser  (replaces clean-browser.ps1)
# -----------------------------------------------------------------------------
function Invoke-Browser {
  param([string]$OverrideUrl = '')

  $target = if ($OverrideUrl) { $OverrideUrl }
            elseif ($Url)      { $Url }
            else {
              $advert = Resolve-AdvertiseHost
              "http://${advert}:$FrontendPort"
            }

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
  if (-not $chrome) { Write-Err 'No Chrome/Chromium found. Install Chrome or run: npx playwright install chromium'; exit 1 }

  Write-Host "Browser : $chrome"
  Write-Host "URL     : $target"

  $profileDir = Join-Path $env:TEMP ('clean-chrome-' + [System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $profileDir | Out-Null
  Write-Host "Profile : $profileDir  (deleted on exit)"

  $chromeArgs = @(
    "--user-data-dir=$profileDir",
    '--no-first-run','--no-default-browser-check','--disable-extensions','--disable-default-apps',
    '--disable-sync','--disable-translate','--disable-background-networking',
    '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows',
    '--disable-client-side-phishing-detection','--disable-component-update','--disable-hang-monitor',
    '--disable-ipc-flooding-protection','--disable-popup-blocking','--disable-prompt-on-repost',
    '--disable-renderer-backgrounding','--disk-cache-size=0','--media-cache-size=0',
    '--disable-application-cache','--password-store=basic','--use-mock-keychain',
    '--metrics-recording-only','--safebrowsing-disable-auto-update','--incognito',
    $target
  )

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

# -----------------------------------------------------------------------------
# Subcommand: test  (replaces test.sh -- k8s multi-user simulation)
# -----------------------------------------------------------------------------
function Invoke-Test {
  if (-not (Test-Tool 'kubectl')) { Write-Err 'kubectl not on PATH. Run .\start.ps1 k8s first.'; exit 1 }
  $tplDir = Join-Path $Root 'Codebase\Infrastructure\session-orchestration\k8s\templates'
  $podTpl   = Join-Path $tplDir 'user-session-pod.yaml'
  $routeTpl = Join-Path $tplDir 'user-routing.yaml'
  if (-not (Test-Path $podTpl) -or -not (Test-Path $routeTpl)) {
    Write-Err "k8s templates missing under $tplDir"; exit 1
  }
  Write-Step "Simulating $Users users requesting C++ isolated sessions"
  for ($i = 1; $i -le $Users; $i++) {
    $uid = "dev-student-$i"
    Write-Host "  -> provisioning $uid"
    (Get-Content $podTpl   -Raw).Replace('{{user_id}}', $uid) | & kubectl apply -f -
    (Get-Content $routeTpl -Raw).Replace('{{user_id}}', $uid) | & kubectl apply -f -
  }
  Start-Sleep -Seconds 3
  & kubectl get pods
}

# -----------------------------------------------------------------------------
# Subcommand: deploy (AWS)
# -----------------------------------------------------------------------------
function Invoke-Deploy {
  $deployScript = Join-Path $Root 'scripts\deploy-aws.ps1'
  if (-not (Test-Path $deployScript)) { Write-Err "Deploy script not found: $deployScript"; exit 1 }
  & $deployScript @Rest
}

# --- Dispatch ---------------------------------------------------------------
if ($Both) {
    Write-Step 'Running BOTH Local and AWS deployment'
    # Start local dev in a separate process so it doesn't block deployment
    Start-Process powershell.exe -ArgumentList "-NoProfile -Command & '$PSCommandPath' dev -NoBrowser"
    Invoke-Deploy
    return
}
if ($Aws -or $Deploy) { Invoke-Deploy; return }
if ($Local)           { Invoke-Dev; return }

switch ($Command) {
  'setup'   { Invoke-Setup }
  'prod'    { $Prod = $true; Invoke-Dev }
  'k8s'     { Invoke-K8s }
  'browser' { Invoke-Browser }
  'test'    { Invoke-Test }
  'deploy'  { Invoke-Deploy }
  default   { Invoke-Dev }
}
