param(
    [string]$ConfigPath = "",
    [string]$UserId = "",
    [string]$Image = "",
    [string]$RuntimeRoot = "",
    [switch]$DockerOnly,
    [switch]$SkipDependencyInstall,
    [switch]$SkipDockerStart,
    [switch]$SkipClusterStart,
    [switch]$SkipImageBuild,
    [switch]$SkipDeploy,
    [switch]$SkipRuntimeLayout,
    [switch]$LegacyWslToolsInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Check if running as Administrator, re-launch with elevation if needed
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin)
{
    Write-Host "[NeoTerritory][Warning] This script requires Administrator privileges to configure Minikube properly." -ForegroundColor Yellow
    Write-Host "[NeoTerritory][Info] Re-launching as Administrator..." -ForegroundColor Cyan
    
    # Reconstruct the command line with all parameters
    $scriptPath = $MyInvocation.MyCommand.Path
    $arguments = @("-NoExit", "-Command", "& '$scriptPath'")
    
    # Add parameters if they were provided
    if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) { $arguments += "-ConfigPath `"$ConfigPath`"" }
    if (-not [string]::IsNullOrWhiteSpace($UserId)) { $arguments += "-UserId `"$UserId`"" }
    if (-not [string]::IsNullOrWhiteSpace($Image)) { $arguments += "-Image `"$Image`"" }
    if (-not [string]::IsNullOrWhiteSpace($RuntimeRoot)) { $arguments += "-RuntimeRoot `"$RuntimeRoot`"" }
    if ($DockerOnly) { $arguments += "-DockerOnly" }
    if ($SkipDependencyInstall) { $arguments += "-SkipDependencyInstall" }
    if ($SkipDockerStart) { $arguments += "-SkipDockerStart" }
    if ($SkipClusterStart) { $arguments += "-SkipClusterStart" }
    if ($SkipImageBuild) { $arguments += "-SkipImageBuild" }
    if ($SkipDeploy) { $arguments += "-SkipDeploy" }
    if ($SkipRuntimeLayout) { $arguments += "-SkipRuntimeLayout" }
    if ($LegacyWslToolsInstall) { $arguments += "-LegacyWslToolsInstall" }
    
    Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs
    exit 0
}

Write-Host "[NeoTerritory][Info] Running with Administrator privileges." -ForegroundColor Green

if ($LegacyWslToolsInstall)
{
    Write-Host "[NeoTerritory][Legacy] Installing Minikube + kubectl in WSL..." -ForegroundColor Yellow

    wsl bash -c "curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64"
    wsl -u root bash -c "install minikube-linux-amd64 /usr/local/bin/minikube"
    wsl bash -c "rm minikube-linux-amd64"

    wsl bash -c "curl -LO 'https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl'"
    wsl -u root bash -c "install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl"
    wsl bash -c "rm kubectl"

    Write-Host "[NeoTerritory][Legacy] WSL tool installation complete." -ForegroundColor Green
    exit 0
}

$bootstrapScript = Join-Path $PSScriptRoot "Infrastructure\session-orchestration\bootstrap_and_deploy.ps1"
if (-not (Test-Path $bootstrapScript))
{
    throw ("Bootstrap script not found: {0}" -f $bootstrapScript)
}

$paramsForBootstrap = @{}
if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) { $paramsForBootstrap.ConfigPath = $ConfigPath }
if (-not [string]::IsNullOrWhiteSpace($UserId)) { $paramsForBootstrap.UserId = $UserId }
if (-not [string]::IsNullOrWhiteSpace($Image)) { $paramsForBootstrap.Image = $Image }
if (-not [string]::IsNullOrWhiteSpace($RuntimeRoot)) { $paramsForBootstrap.RuntimeRoot = $RuntimeRoot }
if ($DockerOnly) { $paramsForBootstrap.DockerOnly = $true }
if ($SkipDependencyInstall) { $paramsForBootstrap.SkipDependencyInstall = $true }
if ($SkipDockerStart) { $paramsForBootstrap.SkipDockerStart = $true }
if ($SkipClusterStart) { $paramsForBootstrap.SkipClusterStart = $true }
if ($SkipImageBuild) { $paramsForBootstrap.SkipImageBuild = $true }
if ($SkipDeploy) { $paramsForBootstrap.SkipDeploy = $true }
if ($SkipRuntimeLayout) { $paramsForBootstrap.SkipRuntimeLayout = $true }

if ($DockerOnly)
{
    Write-Host "[NeoTerritory][Info] Docker-only mode enabled: Minikube start and Kubernetes deploy will be skipped." -ForegroundColor Cyan
    $paramsForBootstrap.SkipClusterStart = $true
    $paramsForBootstrap.SkipDeploy = $true
}

& $bootstrapScript @paramsForBootstrap
if (Get-Variable -Name LASTEXITCODE -Scope Global -ErrorAction SilentlyContinue)
{
    exit $global:LASTEXITCODE
}
exit 0
