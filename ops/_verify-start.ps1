$ErrorActionPreference = 'Stop'

# Mimic start.ps1's param block so libs that reference these don't blow up.
$Lan          = $false
$BindHost     = ''
$BackendPort  = 3001
$FrontendPort = 5173
$BackendOnly  = $false
$NoBrowser    = $false
$SkipPod      = $false
$UseChrome    = $false
$Prod         = $false
$SkipBuild    = $false
$Mode         = 'dev'
$SkipMicroservice = $false
$AutoStart    = $false
$AnthropicKey = ''
$AnthropicModel = 'claude-sonnet-4-6'
$Reset        = $false
$LegacyWslToolsInstall = $false
$Url          = ''
$Playwright   = $false
$Users        = 3
$Rest         = @()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LibDir   = Join-Path $repoRoot 'ops\powershell\start\lib'
$CmdDir   = Join-Path $repoRoot 'ops\powershell\start\commands'

. (Join-Path $LibDir 'env.ps1')
. (Join-Path $LibDir 'output.ps1')
. (Join-Path $LibDir 'host.ps1')
. (Join-Path $LibDir 'utils.ps1')
. (Join-Path $LibDir 'build.ps1')
. (Join-Path $CmdDir 'dev.ps1')
. (Join-Path $CmdDir 'setup.ps1')
. (Join-Path $CmdDir 'k8s.ps1')
. (Join-Path $CmdDir 'browser.ps1')
. (Join-Path $CmdDir 'test.ps1')
. (Join-Path $CmdDir 'deploy.ps1')

# --- Globals from env.ps1 -----------------------------------------------------
foreach ($v in 'Root','BackendDir','FrontendDir','MicroserviceDir',
               'BuildDirName','BuildDir','BinaryName','BinaryPath',
               'EnvFile','Dockerfile','PodImage','MsEnvTag') {
  if (-not (Get-Variable -Name $v -ErrorAction SilentlyContinue)) {
    throw "MISSING global: $v"
  }
}
if (-not (Test-Path (Join-Path $Root 'start.ps1'))) {
  throw "Root resolved wrong: $Root (no start.ps1 there)"
}

# --- Function table -----------------------------------------------------------
$expected = @(
  'Write-Step','Write-Ok','Write-Warn','Write-Err','Test-Tool',
  'Get-LanIp','Resolve-BindHost','Resolve-AdvertiseHost',
  'Free-Port','Wait-Url',
  'Write-DevEnv','Build-Microservice','Ensure-NodeModules',
  'Invoke-Dev','Ensure-PodImage','Invoke-ProdBuilds','Start-Backend','Start-Vite',
  'Studio-Port','Studio-OpenUrl','Print-StudioUrls',
  'Invoke-Setup','Setup-WriteEnv','Setup-WarmupDb',
  'Invoke-K8s','Install-WslLegacyTools',
  'Invoke-Browser','Find-Chrome','Get-CleanChromeArgs',
  'Invoke-Test','Invoke-Deploy'
)
foreach ($fn in $expected) {
  if (-not (Get-Command $fn -ErrorAction SilentlyContinue)) {
    throw "MISSING function: $fn"
  }
}

# --- Exercise pure-logic functions -------------------------------------------
$bindDefault = Resolve-BindHost
if ($bindDefault -ne '127.0.0.1') { throw "Resolve-BindHost default expected 127.0.0.1, got $bindDefault" }

$Lan = $true
$bindLan = Resolve-BindHost
if ($bindLan -ne '0.0.0.0') { throw "Resolve-BindHost (-Lan) expected 0.0.0.0, got $bindLan" }

$BindHost = '10.0.0.5'
$bindExplicit = Resolve-BindHost
if ($bindExplicit -ne '10.0.0.5') { throw "Resolve-BindHost explicit expected 10.0.0.5, got $bindExplicit" }
$BindHost = ''; $Lan = $false

$BackendOnly = $true
$port = Studio-Port
if ($port -ne $BackendPort) { throw "Studio-Port (BackendOnly) expected $BackendPort, got $port" }
$BackendOnly = $false
$port = Studio-Port
if ($port -ne $FrontendPort) { throw "Studio-Port (default) expected $FrontendPort, got $port" }

$openUrl = Studio-OpenUrl -Advert 'localhost'
if ($openUrl -ne "http://localhost:$FrontendPort") { throw "Studio-OpenUrl localhost expected http://localhost:$FrontendPort, got $openUrl" }

# Chrome arg builder shouldn't crash
$args = Get-CleanChromeArgs -ProfileDir 'C:\tmp\x' -Target 'http://localhost:5173'
if ($args.Count -lt 20) { throw "Get-CleanChromeArgs returned only $($args.Count) args" }

Write-Output 'OK -- start.ps1 wiring intact'
Write-Output "  Root         = $Root"
Write-Output "  BuildDirName = $BuildDirName"
Write-Output "  BinaryPath   = $BinaryPath"
Write-Output "  MsEnvTag     = $MsEnvTag"
Write-Output ('  functions    = {0} resolved' -f $expected.Count)
