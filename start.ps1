# NeoTerritory -- single root entry (Windows side).
#
# Slim dispatcher. All real logic lives under ops/powershell/start/{lib,commands}/.
# See docs/Codebase/DESIGN_DECISIONS.md (D28).
#
# Usage:
#   .\start.ps1                                # dev (default)
#   .\start.ps1 --local                        # Local computer deployment (dev)
#   .\start.ps1 --aws                          # AWS Lightsail deployment only
#   .\start.ps1 --both                         # Both local and AWS deployment
#   .\start.ps1 --lan                          # dev, exposed to LAN
#   .\start.ps1 dev --lan --backend-port 4000
#   .\start.ps1 prod                           # production build
#   .\start.ps1 prod --lan                     # production build, exposed to LAN
#   .\start.ps1 setup                          # first-time provision
#   .\start.ps1 setup --mode full --lan        # unattended full provision
#   .\start.ps1 k8s                            # minikube/kubectl
#   .\start.ps1 browser --lan                  # clean Chromium
#   .\start.ps1 test --users 5                 # k8s multi-user sim
#   .\start.ps1 deploy --source                # AWS ship-to-cloud
#
# NOTE: All flags mirror start.sh exactly (GNU-style --flags).
#       Legacy PowerShell -Switch style still accepted for backwards compatibility.

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RawArgs
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Defaults  (mirrors init_arg_defaults in ops/bash/start/lib/args.sh)
# ---------------------------------------------------------------------------
$Command        = 'dev'
$Lan            = $false
$BindHost       = ''
$BackendPort    = 3001
$FrontendPort   = 5173
$Both           = $false

$Rebuild        = $false
$BackendOnly    = $false
$NoBrowser      = $false
$SkipPod        = $false
$UseChrome      = $false
$Prod           = $false
$SkipBuild      = $false

$Mode           = 'dev'
$SkipMicroservice = $false
$AutoStart      = $false
$AnthropicKey   = ''
$AnthropicModel = 'claude-sonnet-4-6'

$Reset          = $false
$UsePw          = $true   # default Playwright, same as start.sh

$Users          = 3
$Deploy         = $false

$Rest = @()

# ---------------------------------------------------------------------------
# Argument parser  (mirrors parse_args in ops/bash/start/lib/args.sh)
# ---------------------------------------------------------------------------
$i    = 0
$argv = if ($RawArgs) { $RawArgs } else { @() }

# Consume optional positional command first (if first arg is not a flag)
if ($argv.Count -gt 0 -and $argv[0] -notmatch '^-') {
  switch ($argv[0]) {
    'dev'     { $Command = 'dev';     $i++ }
    'prod'    { $Command = 'prod';    $i++ }
    'setup'   { $Command = 'setup';   $i++ }
    'k8s'     { $Command = 'k8s';     $i++ }
    'browser' { $Command = 'browser'; $i++ }
    'test'    { $Command = 'test';    $i++ }
    'deploy'  { $Command = 'deploy';  $i++ }
    default   { }
  }
}

while ($i -lt $argv.Count) {
  $arg = $argv[$i]
  switch -Exact ($arg) {
    '--lan'               { $Lan           = $true }
    '-Lan'                { $Lan           = $true }
    '--host'              { $i++; $BindHost      = $argv[$i] }
    '-BindHost'           { $i++; $BindHost      = $argv[$i] }
    '--backend-port'      { $i++; $BackendPort   = [int]$argv[$i] }
    '-BackendPort'        { $i++; $BackendPort   = [int]$argv[$i] }
    '--frontend-port'     { $i++; $FrontendPort  = [int]$argv[$i] }
    '-FrontendPort'       { $i++; $FrontendPort  = [int]$argv[$i] }
    '--deploy'            { $Command = 'deploy' }
    '--aws'               { $Command = 'deploy' }
    '-Aws'                { $Command = 'deploy' }
    '--local'             { $Command = 'dev' }
    '-Local'              { $Command = 'dev' }
    '--both'              { $Both         = $true }
    '-Both'               { $Both         = $true }
    '--rebuild'           { $Rebuild      = $true }
    '-Rebuild'            { $Rebuild      = $true }
    '--backend-only'      { $BackendOnly  = $true }
    '-BackendOnly'        { $BackendOnly  = $true }
    '--no-browser'        { $NoBrowser    = $true }
    '-NoBrowser'          { $NoBrowser    = $true }
    '--skip-pod'          { $SkipPod      = $true }
    '-SkipPod'            { $SkipPod      = $true }
    '--use-chrome'        { $UseChrome    = $true; $UsePw = $false }
    '-UseChrome'          { $UseChrome    = $true; $UsePw = $false }
    '--prod'              { $Prod         = $true }
    '-Prod'               { $Prod         = $true }
    '--skip-build'        { $SkipBuild    = $true }
    '-SkipBuild'          { $SkipBuild    = $true }
    '--mode'              { $i++; $Mode            = $argv[$i] }
    '-Mode'               { $i++; $Mode            = $argv[$i] }
    '--skip-microservice' { $SkipMicroservice = $true }
    '-SkipMicroservice'   { $SkipMicroservice = $true }
    '--auto-start'        { $AutoStart    = $true }
    '-AutoStart'          { $AutoStart    = $true }
    '--anthropic-key'     { $i++; $AnthropicKey    = $argv[$i] }
    '-AnthropicKey'       { $i++; $AnthropicKey    = $argv[$i] }
    '--anthropic-model'   { $i++; $AnthropicModel  = $argv[$i] }
    '-AnthropicModel'     { $i++; $AnthropicModel  = $argv[$i] }
    '--reset'             { $Reset        = $true }
    '-Reset'              { $Reset        = $true }
    '--pw'                { $UsePw        = $true;  $UseChrome = $false }
    '--playwright'        { $UsePw        = $true;  $UseChrome = $false }
    '-Playwright'         { $UsePw        = $true;  $UseChrome = $false }
    '--users'             { $i++; $Users  = [int]$argv[$i] }
    '-Users'              { $i++; $Users  = [int]$argv[$i] }
    '--fix-missing'       { }  # apt-get hint; ignored on Windows — no-op
    '-h'                  { Get-Content $PSCommandPath | Select-Object -First 22; exit 0 }
    '--help'              { Get-Content $PSCommandPath | Select-Object -First 22; exit 0 }
    default               { $Rest += $arg }
  }
  $i++
}

# Propagate into script scope so dot-sourced modules pick them up.
$script:Command          = $Command
$script:Lan              = $Lan
$script:BindHost         = $BindHost
$script:BackendPort      = $BackendPort
$script:FrontendPort     = $FrontendPort
$script:Both             = $Both
$script:Rebuild          = $Rebuild
$script:BackendOnly      = $BackendOnly
$script:NoBrowser        = $NoBrowser
$script:SkipPod          = $SkipPod
$script:UseChrome        = $UseChrome
$script:Prod             = $Prod
$script:SkipBuild        = $SkipBuild
$script:Mode             = $Mode
$script:SkipMicroservice = $SkipMicroservice
$script:AutoStart        = $AutoStart
$script:AnthropicKey     = $AnthropicKey
$script:AnthropicModel   = $AnthropicModel
$script:Reset            = $Reset
$script:UsePw            = $UsePw
$script:Users            = $Users
$script:Deploy           = $Deploy
$script:Rest             = $Rest

# ---------------------------------------------------------------------------
# Load modules  (same order as start.sh sources)
# ---------------------------------------------------------------------------
$LibDir = Join-Path $PSScriptRoot 'ops\powershell\start\lib'
$CmdDir = Join-Path $PSScriptRoot 'ops\powershell\start\commands'

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

# ---------------------------------------------------------------------------
# Dispatch  (mirrors case "$COMMAND" in start.sh)
# ---------------------------------------------------------------------------
if ($Both) {
  Write-Step 'Running BOTH Local and AWS deployment'
  $script:NoBrowser = $true
  Start-Process powershell.exe -ArgumentList "-NoProfile -Command & '$PSCommandPath' dev --no-browser"
  Invoke-Deploy
  return
}
if ($Command -eq 'deploy' -or $Deploy) { Invoke-Deploy; return }

switch ($Command) {
  'setup'   { Invoke-Setup }
  'prod'    { $script:Prod = $true; Invoke-Dev }
  'k8s'     { Invoke-K8s }
  'browser' { Invoke-Browser }
  'test'    { Invoke-Test }
  default   { Invoke-Dev }
}
