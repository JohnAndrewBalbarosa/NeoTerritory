# `start.ps1 setup` — first-time provisioning.

function Invoke-Setup {
  Set-Location $Root
  $verifier = Join-Path $Root 'scripts\verify-requirements.ps1'
  if (Test-Path $verifier) {
    . $verifier
    try { Test-Requirements -Profile dev -AutoInstall | Out-Null }
    catch { Write-Err "Setup aborted -- requirements not met: $($_.Exception.Message)"; exit 1 }
  }

  Write-Step "Setup mode: $Mode"

  Write-Step 'Phase 2: Backend npm install'
  Push-Location $BackendDir
  try { & npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } } finally { Pop-Location }
  Write-Ok 'Backend dependencies installed.'

  Write-Step 'Phase 2b: Frontend npm install'
  Push-Location $FrontendDir
  try { & npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } } finally { Pop-Location }
  Write-Ok 'Frontend dependencies installed.'

  if (-not $SkipMicroservice) { Build-Microservice -Force:$false }

  Setup-WriteEnv
  Setup-WarmupDb

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

function Setup-WriteEnv {
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
}

function Setup-WarmupDb {
  if ($Mode -ne 'full') { return }
  Write-Step 'Phase 5: Database warm-up'
  Push-Location $BackendDir
  try {
    & node -e "const { initDb } = require('./src/db/initDb'); initDb(); console.log('schema initialized');"
    if ($LASTEXITCODE -ne 0) { throw 'DB init failed.' }
    Write-Ok 'Database schema initialized.'
  } finally { Pop-Location }
}
