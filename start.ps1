# NeoTerritory -- single root entry (Windows side).
#
# Slim dispatcher. All real logic lives under ops/powershell/start/{lib,commands}/.
# See docs/Codebase/DESIGN_DECISIONS.md (D28).
#
# Usage:
#   .\start.ps1 -Local                       # Local computer deployment (dev)
#   .\start.ps1 -Aws                         # AWS Lightsail deployment only
#   .\start.ps1 -Both                        # Both local and AWS deployment
#   .\start.ps1 -Lan                         # dev, exposed to LAN
#   .\start.ps1 -BindHost [IP_ADDRESS]       # bind to exact IP
#   .\start.ps1 dev -Lan -BackendPort 4000
#   .\start.ps1 setup                        # first-time provision
#   .\start.ps1 setup -Mode full -Lan        # unattended full provision
#   .\start.ps1 k8s                          # minikube/kubectl
#   .\start.ps1 browser -Lan                 # clean Chromium
#   .\start.ps1 test -Users 5                # k8s multi-user sim
#   .\start.ps1 deploy --source              # AWS ship-to-cloud
#   .\start.ps1 rebuild                      # full local rebuild (canonical)
#   .\start.ps1 rebuild -SkipMicroservice    # exclude C++ build
#   .\start.ps1 rebuild -ModeA               # rebuild then hot-reload

param(
  [Parameter(Position = 0)]
  [ValidateSet('dev','prod','setup','k8s','browser','test','deploy','rebuild','')]
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
$LibDir = Join-Path $PSScriptRoot 'ops\powershell\start\lib'
$CmdDir = Join-Path $PSScriptRoot 'ops\powershell\start\commands'

# Dot-source modules so functions + variables land in this script's scope.
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

# --- Dispatch ---------------------------------------------------------------
if ($Command -eq 'rebuild') {
    # Forward to canonical rebuild script. Pass through known rebuild switches
    # (start.ps1 already declares -SkipMicroservice; the rest are forwarded as-is).
    $rebuildArgs = @()
    if ($SkipMicroservice) { $rebuildArgs += '-SkipMicroservice' }
    if ($Rest) { $rebuildArgs += $Rest }
    & (Join-Path $PSScriptRoot 'scripts\rebuild.ps1') @rebuildArgs
    return
}

if ($Both) {
    Write-Step 'Running BOTH Local and AWS deployment'
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
