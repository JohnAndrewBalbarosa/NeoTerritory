param(
    [string]$ConfigPath = "",
    [string]$UserId = "",
    [string]$Image = "",
    [string]$RuntimeRoot = "",
    [switch]$SkipDependencyInstall,
    [switch]$SkipDockerStart,
    [switch]$SkipClusterStart,
    [switch]$SkipImageBuild,
    [switch]$SkipDeploy,
    [switch]$SkipRuntimeLayout
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message)
{
    Write-Host "[NeoTerritory][Step] $Message" -ForegroundColor Cyan
}

function Write-Info([string]$Message)
{
    Write-Host "[NeoTerritory][Info] $Message"
}

function Test-CommandExists([string]$CommandName)
{
    return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Invoke-ExternalCommand(
    [string]$FilePath,
    [string[]]$Arguments)
{
    Write-Host ("> {0} {1}" -f $FilePath, ($Arguments -join " ")) -ForegroundColor DarkGray
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0)
    {
        throw ("Command failed with exit code {0}: {1}" -f $LASTEXITCODE, $FilePath)
    }
}

function Install-WithWinget(
    [string]$PackageId,
    [string]$DisplayName)
{
    if (-not (Test-CommandExists "winget"))
    {
        throw "winget is not installed. Install App Installer from Microsoft Store first."
    }

    Write-Step ("Installing {0} via winget..." -f $DisplayName)
    Invoke-ExternalCommand "winget" @(
        "install",
        "--id", $PackageId,
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements"
    )
}

function Wait-ForDocker([int]$TimeoutSeconds = 240)
{
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline)
    {
        if (Test-CommandExists "docker")
        {
            & docker info *> $null
            if ($LASTEXITCODE -eq 0)
            {
                return
            }
        }
        Start-Sleep -Seconds 3
    }

    throw "Docker daemon was not ready within timeout."
}

function Resolve-AbsolutePath([string]$BaseDir, [string]$RelativeOrAbsolutePath)
{
    if ([System.IO.Path]::IsPathRooted($RelativeOrAbsolutePath))
    {
        return [System.IO.Path]::GetFullPath($RelativeOrAbsolutePath)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $BaseDir $RelativeOrAbsolutePath))
}

function Apply-K8sTemplate(
    [string]$TemplatePath,
    [string]$ResolvedUserId,
    [string]$ResolvedImage)
{
    $templateContent = Get-Content -Raw $TemplatePath
    $rendered = $templateContent.Replace("{{user_id}}", $ResolvedUserId).Replace("{{image}}", $ResolvedImage)

    $tempPath = [System.IO.Path]::GetTempFileName()
    try
    {
        Set-Content -Path $tempPath -Value $rendered -Encoding UTF8
        Invoke-ExternalCommand "kubectl" @("apply", "-f", $tempPath)
    }
    finally
    {
        if (Test-Path $tempPath)
        {
            Remove-Item -Path $tempPath -Force
        }
    }
}

try
{
    $scriptRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot "..\.."))

    if ([string]::IsNullOrWhiteSpace($ConfigPath))
    {
        $ConfigPath = Join-Path $scriptRoot "installer.config.json"
    }
    $resolvedConfigPath = Resolve-AbsolutePath $repoRoot $ConfigPath
    if (-not (Test-Path $resolvedConfigPath))
    {
        throw ("Config file does not exist: {0}" -f $resolvedConfigPath)
    }

    Write-Step ("Loading installer config from {0}" -f $resolvedConfigPath)
    $config = Get-Content -Raw $resolvedConfigPath | ConvertFrom-Json

    $resolvedUserId = if ([string]::IsNullOrWhiteSpace($UserId)) { [string]$config.userId } else { $UserId }
    $resolvedImage = if ([string]::IsNullOrWhiteSpace($Image)) { [string]$config.image } else { $Image }
    $resolvedRuntimeRootRel = if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) { [string]$config.runtimeRoot } else { $RuntimeRoot }
    $resolvedRuntimeRoot = Resolve-AbsolutePath $repoRoot $resolvedRuntimeRootRel
    $minikubeProfile = [string]$config.minikubeProfile
    $dockerfilePath = Resolve-AbsolutePath $repoRoot ([string]$config.dockerfile)
    $templatePaths = @($config.k8sTemplates | ForEach-Object { Resolve-AbsolutePath $repoRoot ([string]$_) })

    if ([string]::IsNullOrWhiteSpace($resolvedUserId))
    {
        throw "Config 'userId' is required."
    }
    if ([string]::IsNullOrWhiteSpace($resolvedImage))
    {
        throw "Config 'image' is required."
    }
    if ([string]::IsNullOrWhiteSpace($minikubeProfile))
    {
        throw "Config 'minikubeProfile' is required."
    }
    if (-not (Test-Path $dockerfilePath))
    {
        throw ("Dockerfile does not exist: {0}" -f $dockerfilePath)
    }
    if ($templatePaths.Count -eq 0)
    {
        throw "Config 'k8sTemplates' must contain at least one template path."
    }
    foreach ($path in $templatePaths)
    {
        if (-not (Test-Path $path))
        {
            throw ("K8s template does not exist: {0}" -f $path)
        }
    }

    if (-not $SkipDependencyInstall)
    {
        Write-Step "Checking/installing dependencies..."
        if (-not (Test-CommandExists "docker"))
        {
            Install-WithWinget -PackageId "Docker.DockerDesktop" -DisplayName "Docker Desktop"
        }
        if (-not (Test-CommandExists "kubectl"))
        {
            Install-WithWinget -PackageId "Kubernetes.kubectl" -DisplayName "kubectl"
        }
        if (-not (Test-CommandExists "minikube"))
        {
            Install-WithWinget -PackageId "Kubernetes.minikube" -DisplayName "Minikube"
        }
    }

    if (-not $SkipDockerStart)
    {
        Write-Step "Ensuring Docker daemon is running..."
        if (-not (Test-CommandExists "docker"))
        {
            throw "Docker CLI is unavailable. Install Docker Desktop first."
        }

        $dockerDesktopExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktopExe)
        {
            Start-Process -FilePath $dockerDesktopExe | Out-Null
        }
        Wait-ForDocker
        Write-Info "Docker is ready."
    }

    if (-not $SkipClusterStart)
    {
        Write-Step ("Starting Minikube profile '{0}'..." -f $minikubeProfile)
        Invoke-ExternalCommand "minikube" @("start", "-p", $minikubeProfile, "--driver=docker")
        Invoke-ExternalCommand "kubectl" @("cluster-info")
    }

    if (-not $SkipImageBuild)
    {
        Write-Step "Configuring shell to use Minikube Docker daemon..."
        $dockerEnv = & minikube -p $minikubeProfile docker-env --shell powershell
        if ($LASTEXITCODE -ne 0)
        {
            throw "Failed to query Minikube Docker environment."
        }
        Invoke-Expression (($dockerEnv -join "`n"))

        Write-Step ("Building image '{0}'..." -f $resolvedImage)
        Invoke-ExternalCommand "docker" @(
            "build",
            "-t", $resolvedImage,
            "-f", $dockerfilePath,
            $repoRoot
        )
    }

    if (-not $SkipDeploy)
    {
        Write-Step "Applying Kubernetes templates..."
        foreach ($templatePath in $templatePaths)
        {
            Write-Info ("Applying template: {0}" -f $templatePath)
            Apply-K8sTemplate -TemplatePath $templatePath -ResolvedUserId $resolvedUserId -ResolvedImage $resolvedImage
        }
        Invoke-ExternalCommand "kubectl" @("get", "pods", "-o", "wide")
    }

    if (-not $SkipRuntimeLayout)
    {
        $runtimeLayoutScript = Join-Path $repoRoot "Infrastructure\runtime-layout\setup_runtime_layout.ps1"
        if (-not (Test-Path $runtimeLayoutScript))
        {
            throw ("Runtime layout script not found: {0}" -f $runtimeLayoutScript)
        }

        Write-Step ("Preparing runtime layout at '{0}'..." -f $resolvedRuntimeRoot)
        & $runtimeLayoutScript -TargetDir $resolvedRuntimeRoot
        if ($LASTEXITCODE -ne 0)
        {
            throw "Runtime layout preparation failed."
        }
    }

    Write-Host ""
    Write-Host "[NeoTerritory] Bootstrap complete." -ForegroundColor Green
    Write-Host ("- User session id: {0}" -f $resolvedUserId)
    Write-Host ("- Image: {0}" -f $resolvedImage)
    Write-Host ("- Runtime root: {0}" -f $resolvedRuntimeRoot)
    Write-Host ("- Check pods: kubectl get pods")
}
catch
{
    Write-Host ("[NeoTerritory][Error] {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
