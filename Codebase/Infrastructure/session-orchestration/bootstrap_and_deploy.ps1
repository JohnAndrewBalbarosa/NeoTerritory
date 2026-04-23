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

function Get-WingetPath()
{
    # First, try to find winget in PATH
    $wingetCmd = Get-Command "winget" -ErrorAction SilentlyContinue
    if ($wingetCmd)
    {
        return $wingetCmd.Source
    }

    # If not in PATH, search for it in Windows.apps installations
    $appxPackage = Get-AppxPackage -Name "Microsoft.DesktopAppInstaller" -ErrorAction SilentlyContinue
    if ($appxPackage)
    {
        $installPath = $appxPackage.InstallLocation
        $wingetExe = Join-Path $installPath "winget.exe"
        if (Test-Path $wingetExe)
        {
            return $wingetExe
        }
    }

    return $null
}

function Get-DockerPath()
{
    # First, try to find docker in PATH
    $dockerCmd = Get-Command "docker" -ErrorAction SilentlyContinue
    if ($dockerCmd)
    {
        return $dockerCmd.Source
    }

    # If not in PATH, search for it in standard Docker Desktop locations
    $commonPaths = @(
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        "C:\Program Files (x86)\Docker\Docker\resources\bin\docker.exe"
    )

    foreach ($path in $commonPaths)
    {
        if (Test-Path $path)
        {
            return $path
        }
    }

    return $null
}

function Get-MinikubePath()
{
    # First, try to find minikube in PATH
    $minikubeCmd = Get-Command "minikube" -ErrorAction SilentlyContinue
    if ($minikubeCmd)
    {
        return $minikubeCmd.Source
    }

    # If not in PATH, check common installation locations
    $commonPaths = @(
        "C:\Program Files\Kubernetes\Minikube\minikube.exe",
        "C:\Program Files (x86)\Kubernetes\Minikube\minikube.exe",
        "$env:LOCALAPPDATA\Programs\Kubernetes\Minikube\minikube.exe"
    )

    foreach ($path in $commonPaths)
    {
        if (Test-Path $path)
        {
            return $path
        }
    }

    return $null
}

function Get-KubectlPath()
{
    # First, try to find kubectl in PATH
    $kubectlCmd = Get-Command "kubectl" -ErrorAction SilentlyContinue
    if ($kubectlCmd)
    {
        return $kubectlCmd.Source
    }

    # If not in PATH, check common installation locations
    $commonPaths = @(
        "C:\Program Files\Kubernetes\kubectl\kubectl.exe",
        "C:\Program Files (x86)\Kubernetes\kubectl\kubectl.exe",
        "$env:LOCALAPPDATA\Programs\Kubernetes\kubectl\kubectl.exe"
    )

    foreach ($path in $commonPaths)
    {
        if (Test-Path $path)
        {
            return $path
        }
    }

    return $null
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
    $wingetPath = Get-WingetPath
    if (-not $wingetPath)
    {
        throw "winget is not installed. Install App Installer from Microsoft Store first."
    }

    Write-Step ("Installing {0} via winget..." -f $DisplayName)
    $output = & $wingetPath install --id $PackageId -e --accept-package-agreements --accept-source-agreements 2>&1
    $exitCode = $LASTEXITCODE
    
    # Exit code -1978335189 typically means package already installed, which is fine
    # Exit code 0 or the "already installed" code are both acceptable
    if ($exitCode -ne 0 -and $exitCode -ne -1978335189)
    {
        $outputStr = $output -join "`n"
        if ($outputStr -like "*already installed*" -or $outputStr -like "*No available upgrade*")
        {
            Write-Info ("{0} is already installed." -f $DisplayName)
            return
        }
        throw ("Failed to install {0}. Exit code: {1}" -f $DisplayName, $exitCode)
    }
    
    Write-Info ("{0} installation completed." -f $DisplayName)
}

function Wait-ForDocker(
    [string]$DockerPath = "",
    [int]$TimeoutSeconds = 240)
{
    if ([string]::IsNullOrWhiteSpace($DockerPath))
    {
        $DockerPath = Get-DockerPath
        if (-not $DockerPath)
        {
            throw "Docker path not available."
        }
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline)
    {
        & $DockerPath info *> $null
        if ($LASTEXITCODE -eq 0)
        {
            return
        }
        Start-Sleep -Seconds 3
    }

    throw "Docker daemon was not ready within timeout."
}

function Test-MinikubeProfileCorrupted([string]$ProfileName)
{
    $minikubeRoot = Join-Path $env:USERPROFILE ".minikube"
    $machineConfigPath = Join-Path $minikubeRoot "machines\$ProfileName\config.json"
    $profileConfigPath = Join-Path $minikubeRoot "profiles\$ProfileName\config.json"

    $machineDirExists = Test-Path (Split-Path $machineConfigPath -Parent) -PathType Container
    $profileDirExists = Test-Path (Split-Path $profileConfigPath -Parent) -PathType Container
    $machineConfigExists = Test-Path $machineConfigPath -PathType Leaf
    $profileConfigExists = Test-Path $profileConfigPath -PathType Leaf

    return (($profileDirExists -and -not $machineConfigExists) -or ($machineDirExists -and -not $profileConfigExists))
}

function Invoke-MinikubeDeleteBestEffort(
    [string]$MinikubePath,
    [string]$ProfileName)
{
    Write-Info ("Attempting to delete Minikube profile '{0}'..." -f $ProfileName)
    $deleteOutput = @()
    $hasNativePref = [bool](Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
    $previousNativePref = $null
    if ($hasNativePref)
    {
        $previousNativePref = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }

    try
    {
        $deleteOutput = & $MinikubePath delete -p $ProfileName 2>&1
    }
    finally
    {
        if ($hasNativePref)
        {
            $PSNativeCommandUseErrorActionPreference = $previousNativePref
        }
    }

    if ($deleteOutput)
    {
        $deleteOutput | ForEach-Object { Write-Host $_ }
    }

    if ($LASTEXITCODE -ne 0)
    {
        Write-Info ("minikube delete exited with code {0}; continuing with local profile cleanup." -f $LASTEXITCODE)
    }
}

function Remove-MinikubeProfileArtifacts([string]$ProfileName)
{
    if ([string]::IsNullOrWhiteSpace($ProfileName))
    {
        throw "Profile name is required for Minikube cleanup."
    }

    $minikubeRoot = Join-Path $env:USERPROFILE ".minikube"
    $paths = @(
        Join-Path $minikubeRoot "machines\$ProfileName",
        Join-Path $minikubeRoot "profiles\$ProfileName"
    )

    foreach ($path in $paths)
    {
        if (Test-Path $path)
        {
            Write-Info ("Removing Minikube state path: {0}" -f $path)
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
        }
    }
}

function Start-MinikubeWithRecovery(
    [string]$MinikubePath,
    [string]$ProfileName)
{
    if (Test-MinikubeProfileCorrupted -ProfileName $ProfileName)
    {
        Write-Info "Detected broken Minikube profile metadata before start. Cleaning up."
        Invoke-MinikubeDeleteBestEffort -MinikubePath $MinikubePath -ProfileName $ProfileName
        Remove-MinikubeProfileArtifacts -ProfileName $ProfileName
    }

    $startArgs = @("start", "-p", $ProfileName, "--driver=docker")
    Write-Host ("> {0} {1}" -f $MinikubePath, ($startArgs -join " ")) -ForegroundColor DarkGray
    $startOutput = @()
    $startExitCode = 1
    $hasNativePref = [bool](Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
    $previousNativePref = $null
    if ($hasNativePref)
    {
        $previousNativePref = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }

    try
    {
        $startOutput = & $MinikubePath @startArgs 2>&1
        $startExitCode = $LASTEXITCODE
    }
    finally
    {
        if ($hasNativePref)
        {
            $PSNativeCommandUseErrorActionPreference = $previousNativePref
        }
    }

    if ($startOutput)
    {
        $startOutput | ForEach-Object { Write-Host $_ }
    }

    if ($startExitCode -eq 0)
    {
        return
    }

    $startText = ($startOutput | Out-String)
    $recoverableFailure = (
        $startText -match "unable to execute icacls" -or
        $startText -match "error loading existing host" -or
        $startText -match "open .*\.minikube\\machines\\.*\\config\.json" -or
        $startText -match "Failed to start docker container"
    )

    if (-not $recoverableFailure)
    {
        throw ("Minikube start failed with exit code {0}." -f $startExitCode)
    }

    Write-Info "Minikube startup failed with recoverable profile state error. Cleaning up and retrying once."
    Invoke-MinikubeDeleteBestEffort -MinikubePath $MinikubePath -ProfileName $ProfileName
    Remove-MinikubeProfileArtifacts -ProfileName $ProfileName
    Start-Sleep -Seconds 1
    Invoke-ExternalCommand $MinikubePath $startArgs
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
    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot "..\..\.."))

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
    $effectiveSkipClusterStart = [bool]($SkipClusterStart -or $DockerOnly)
    $effectiveSkipDeploy = [bool]($SkipDeploy -or $DockerOnly)
    $requiresMinikubeProfile = [bool]((-not $effectiveSkipClusterStart) -or ((-not $DockerOnly) -and (-not $SkipImageBuild)))
    $executionMode = if ($DockerOnly) { "Docker-only" } else { "Full Kubernetes" }

    Write-Info ("Execution mode: {0}" -f $executionMode)
    if ($DockerOnly)
    {
        Write-Info "Minikube start and Kubernetes deploy are disabled for this run."
    }

    if ([string]::IsNullOrWhiteSpace($resolvedUserId))
    {
        throw "Config 'userId' is required."
    }
    if ([string]::IsNullOrWhiteSpace($resolvedImage))
    {
        throw "Config 'image' is required."
    }
    if ($requiresMinikubeProfile -and [string]::IsNullOrWhiteSpace($minikubeProfile))
    {
        throw "Config 'minikubeProfile' is required."
    }
    if (-not $SkipImageBuild -and -not (Test-Path $dockerfilePath))
    {
        throw ("Dockerfile does not exist: {0}" -f $dockerfilePath)
    }
    if (-not $effectiveSkipDeploy -and $templatePaths.Count -eq 0)
    {
        throw "Config 'k8sTemplates' must contain at least one template path."
    }
    foreach ($path in $templatePaths)
    {
        if (-not $effectiveSkipDeploy -and -not (Test-Path $path))
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
        if (-not (Get-KubectlPath))
        {
            Install-WithWinget -PackageId "Kubernetes.kubectl" -DisplayName "kubectl"
        }
        if (-not (Get-MinikubePath))
        {
            Install-WithWinget -PackageId "Kubernetes.minikube" -DisplayName "Minikube"
        }
    }

    if (-not $SkipDockerStart)
    {
        Write-Step "Ensuring Docker daemon is running..."
        $dockerPath = Get-DockerPath
        if (-not $dockerPath)
        {
            throw "Docker CLI is unavailable. Install Docker Desktop first."
        }

        $dockerDesktopExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktopExe)
        {
            Start-Process -FilePath $dockerDesktopExe | Out-Null
        }
        Wait-ForDocker -DockerPath $dockerPath
        Write-Info "Docker is ready."
    }

    if (-not $effectiveSkipClusterStart)
    {
        Write-Step ("Starting Minikube profile '{0}'..." -f $minikubeProfile)
        
        # Ensure Docker and Kubernetes tools are in PATH
        $dockerPath = Get-DockerPath
        if ($dockerPath)
        {
            $dockerDir = Split-Path $dockerPath -Parent
            $env:PATH = "$dockerDir;$env:PATH"
        }
        
        $kubectlPath = Get-KubectlPath
        if ($kubectlPath)
        {
            $kubectlDir = Split-Path $kubectlPath -Parent
            $env:PATH = "$kubectlDir;$env:PATH"
        }
        
        $minikubePath = Get-MinikubePath
        if (-not $minikubePath)
        {
            throw "Minikube is not installed. Please install Minikube first."
        }
        
        $minikubeDir = Split-Path $minikubePath -Parent
        $env:PATH = "$minikubeDir;$env:PATH"
        
        Write-Step "Checking Minikube profile state..."
        Start-MinikubeWithRecovery -MinikubePath $minikubePath -ProfileName $minikubeProfile
        
        if (-not $kubectlPath)
        {
            throw "kubectl is not installed. Please install kubectl first."
        }
        Invoke-ExternalCommand $kubectlPath @("cluster-info")
    }

    if (-not $SkipImageBuild)
    {
        $dockerPath = Get-DockerPath
        if (-not $dockerPath)
        {
            throw "Docker path not available for image build."
        }
        $dockerDir = Split-Path $dockerPath -Parent
        $env:PATH = "$dockerDir;$env:PATH"

        if ($DockerOnly)
        {
            Write-Step ("Building image '{0}' with local Docker daemon..." -f $resolvedImage)
            Invoke-ExternalCommand $dockerPath @(
                "build",
                "-t", $resolvedImage,
                "-f", $dockerfilePath,
                $repoRoot
            )
        }
        else
        {
            Write-Step "Configuring shell to use Minikube Docker daemon..."

            # Ensure tools are in PATH
            $minikubePath = Get-MinikubePath
            if (-not $minikubePath)
            {
                throw "Minikube is not installed. Please install Minikube first."
            }
            $minikubeDir = Split-Path $minikubePath -Parent
            $env:PATH = "$minikubeDir;$env:PATH"

            $dockerEnv = & $minikubePath -p $minikubeProfile docker-env --shell powershell
            if ($LASTEXITCODE -ne 0)
            {
                throw "Failed to query Minikube Docker environment."
            }
            Invoke-Expression (($dockerEnv -join "`n"))

            Write-Step ("Building image '{0}'..." -f $resolvedImage)
            Invoke-ExternalCommand $dockerPath @(
                "build",
                "-t", $resolvedImage,
                "-f", $dockerfilePath,
                $repoRoot
            )
        }
    }

    if (-not $effectiveSkipDeploy)
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
        $runtimeLayoutScript = Join-Path $repoRoot "Codebase\Infrastructure\runtime-layout\setup_runtime_layout.ps1"
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
    Write-Host ("- Mode: {0}" -f $executionMode)
    if (-not $effectiveSkipDeploy)
    {
        Write-Host ("- Check pods: kubectl get pods")
    }
    else
    {
        Write-Host ("- Docker image ready: docker images {0}" -f $resolvedImage)
    }
}
catch
{
    Write-Host ("[NeoTerritory][Error] {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
