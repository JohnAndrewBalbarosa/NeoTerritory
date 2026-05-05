# `start.ps1 test` — k8s multi-user provisioning sim.

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
