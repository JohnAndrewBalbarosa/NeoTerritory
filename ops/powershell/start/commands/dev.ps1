# `start.ps1 dev` (and `prod`) — local development server stack.

function Invoke-Dev {
  . (Join-Path $Root 'scripts\verify-requirements.ps1')
  $reqProfile = if ($SkipPod) { 'dev' } else { 'pods' }
  $softDocker = (-not $SkipPod)
  try { $script:report = Test-Requirements -Profile $reqProfile -AutoInstall -Soft:$softDocker }
  catch { Write-Err "Aborting -- requirements not met: $($_.Exception.Message)"; exit 1 }

  $bind   = Resolve-BindHost
  $advert = Resolve-AdvertiseHost

  Ensure-PodImage
  Ensure-NodeModules -Dir $BackendDir -Label 'Backend'
  if (-not $BackendOnly) { Ensure-NodeModules -Dir $FrontendDir -Label 'Frontend' }

  Write-DevEnv -Port $BackendPort -VitePort $FrontendPort -AdvertiseHost $advert
  Build-Microservice -Force:$Rebuild

  if ($Prod -and -not $SkipBuild) { Invoke-ProdBuilds }

  $serverProc = Start-Backend -Bind $bind -Advert $advert
  $viteProc   = Start-Vite    -Bind $bind

  Print-StudioUrls -Advert $advert -ServerProc $serverProc -ViteProc $viteProc

  if (-not $NoBrowser) {
    Write-Step "Launching clean Chromium ($(if ($UseChrome) { 'Chrome' } else { 'Playwright' }))"
    Invoke-Browser -OverrideUrl (Studio-OpenUrl -Advert $advert)
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

function Ensure-PodImage {
  if ($SkipPod) { return }
  Write-Step 'Checking Docker pod image'
  if (-not $report.docker) {
    Write-Warn 'docker not on PATH -- pod isolation skipped; backend uses local sandbox.'; return
  }
  if (-not $report.dockerDaemon) {
    Write-Warn 'docker daemon not responding -- start Docker Desktop and re-run.'; return
  }
  $imageExists = $false
  try { & docker image inspect $PodImage *> $null; $imageExists = ($LASTEXITCODE -eq 0) } catch { }
  if ($imageExists) { Write-Ok "$PodImage already built."; return }
  if (-not (Test-Path $Dockerfile)) {
    Write-Warn "Dockerfile not found at $Dockerfile -- pod isolation unavailable."; return
  }
  Write-Step "Building $PodImage from $Dockerfile (one-time, ~30-60s)"
  & docker build -f $Dockerfile -t $PodImage $Root
  if ($LASTEXITCODE -ne 0) { Write-Warn 'docker build failed -- falling back to local sandbox.' }
  else { Write-Ok "$PodImage ready." }
}

function Invoke-ProdBuilds {
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

function Start-Backend {
  param([string]$Bind, [string]$Advert)
  $backendScript = if ($Prod) { 'start' } else { 'dev' }
  $modeLabel     = if ($Prod) { 'prod' } else { 'dev' }

  Write-Step "Starting backend (bind=$Bind, port=$BackendPort, mode=$modeLabel)"
  $env:PORT = "$BackendPort"
  $env:HOST = $Bind
  if (($Lan -or $BindHost) -and $Advert -ne 'localhost') {
    $env:CORS_ORIGIN = "http://localhost:$BackendPort,http://localhost:$FrontendPort,http://${Advert}:$BackendPort,http://${Advert}:$FrontendPort"
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
  return $serverProc
}

function Start-Vite {
  param([string]$Bind)
  if ($BackendOnly) { return $null }

  $viteScript = if ($Prod) { 'preview' } else { 'dev' }
  $viteLabel  = if ($Prod) { 'Vite preview' } else { 'Vite dev server' }
  Write-Step "Starting $viteLabel (bind=$Bind, port=$FrontendPort)"
  Free-Port $FrontendPort
  $env:VITE_HOST = $Bind
  $viteCmdArgs = @('run',$viteScript,'--','--port',"$FrontendPort",'--strictPort')
  if ($Bind -eq '0.0.0.0' -or $Lan) { $viteCmdArgs += @('--host','0.0.0.0') }
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
    Stop-Process -Id $viteProc.Id -Force -ErrorAction SilentlyContinue
    exit 1
  }
  Write-Ok 'Vite ready.'
  return $viteProc
}

function Studio-Port {
  if ($BackendOnly) { return $BackendPort } else { return $FrontendPort }
}

function Studio-OpenUrl {
  param([string]$Advert)
  $port = Studio-Port
  if ($Advert -ne 'localhost') { return "http://${Advert}:$port" }
  return "http://localhost:$port"
}

function Print-StudioUrls {
  param([string]$Advert, $ServerProc, $ViteProc)
  $port     = Studio-Port
  $localUrl = "http://localhost:$port"
  $lanUrl   = if ($Advert -ne 'localhost') { "http://${Advert}:$port" } else { $null }

  Write-Host ''
  Write-Host "  Studio:        $localUrl" -ForegroundColor White
  if ($lanUrl) { Write-Host "  Studio (LAN):  $lanUrl"   -ForegroundColor White }
  Write-Host "  Backend API:   http://localhost:$BackendPort" -ForegroundColor White
  Write-Host "  Health:        http://localhost:$BackendPort/api/health" -ForegroundColor White
  Write-Host "  Backend PID:   $($ServerProc.Id)" -ForegroundColor White
  if ($ViteProc) { Write-Host "  Vite PID:      $($ViteProc.Id)" -ForegroundColor White }
  Write-Host ''
  Write-Host 'Ctrl+C stops the backend, Vite, and the browser.' -ForegroundColor Gray
}
