# `start.ps1 k8s` — minikube/kubectl bootstrap (replaces old setup.ps1).

function Invoke-K8s {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Write-Warn 'k8s mode needs Administrator. Re-launching elevated...'
    $argsList = @('-NoExit','-Command',"& '$PSCommandPath' k8s")
    if ($Reset) { $argsList += '-Reset' }
    if ($LegacyWslToolsInstall) { $argsList += '-LegacyWslToolsInstall' }
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argsList -Verb RunAs
    exit 0
  }
  Write-Ok 'Running with Administrator privileges.'

  if ($LegacyWslToolsInstall) { Install-WslLegacyTools; return }

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

function Install-WslLegacyTools {
  Write-Step 'Installing Minikube + kubectl in WSL (legacy path)'
  wsl bash -c 'curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64'
  wsl -u root bash -c 'install minikube-linux-amd64 /usr/local/bin/minikube'
  wsl bash -c 'rm minikube-linux-amd64'
  wsl bash -c 'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"'
  wsl -u root bash -c 'install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl'
  wsl bash -c 'rm kubectl'
  Write-Ok 'WSL tool installation complete.'
}
