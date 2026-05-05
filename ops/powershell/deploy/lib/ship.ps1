# Ship to AWS — either source-mode (tar + remote build) or image-mode
# (docker save | ssh docker load).

function Ship-Source {
  param(
    [string]$RootDir, [string]$SshOpts, [string]$SshTarget,
    [string]$RemoteAppDir, [string]$ImageRef, [switch]$DryRun
  )
  Write-Host "-- Shipping SOURCE to ${SshTarget}:$RemoteAppDir (remote will build) --"
  if ($DryRun) {
    Write-Host "-> tar source -> ssh $SshTarget 'untar + docker build $ImageRef'"
    return
  }
  $tarTmp = New-TemporaryFile
  try {
    # ALLOWLIST: only paths the docker build actually needs leave the laptop.
    $includes = @(
      'Codebase/Backend',
      'Codebase/Frontend',
      'Codebase/Microservice',
      'Codebase/Infrastructure/session-orchestration/docker',
      'scripts',
      'start.sh',
      'start.ps1'
    )
    $excludes = @(
      '--exclude=**/.git','--exclude=**/node_modules',
      '--exclude=**/dist','--exclude=**/build','--exclude=**/build-linux',
      '--exclude=**/out','--exclude=**/.next','--exclude=**/.cache',
      '--exclude=**/coverage','--exclude=**/__pycache__',
      '--exclude=**/*.log','--exclude=**/*.tsbuildinfo',
      '--exclude=**/*.sqlite','--exclude=**/*.sqlite-journal',
      '--exclude=**/.DS_Store','--exclude=**/Thumbs.db',
      '--exclude=**/*.pem','--exclude=**/*.key',
      '--exclude=**/.env','--exclude=**/.env.*',
      '--exclude=Codebase/Backend/uploads','--exclude=Codebase/Backend/outputs',
      '--exclude=Codebase/Backend/server.out.log','--exclude=Codebase/Backend/server.err.log',
      '--exclude=Codebase/Backend/keys',
      '--exclude=Codebase/Microservice/Test'
    )
    Push-Location $RootDir
    try { & tar @excludes -czf $tarTmp.FullName @includes } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'tar failed' }
    Invoke-Expression "ssh $SshOpts `"$SshTarget`" `"mkdir -p '$RemoteAppDir'`""
    Invoke-Expression "scp $SshOpts `"$($tarTmp.FullName)`" `"$($SshTarget):/tmp/neoterritory-src.tgz`""
    $remoteBuild = @"
set -e
cd "$RemoteAppDir"
tar -xzf /tmp/neoterritory-src.tgz
rm -f /tmp/neoterritory-src.tgz
if ! command -v docker >/dev/null 2>&1; then
  echo '-> installing docker on remote'
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "\$USER" || true
fi
docker build -f "Codebase/Infrastructure/session-orchestration/docker/Dockerfile" -t "$ImageRef" .
"@
    $remoteBuild | & ssh $SshOpts.Split(' ') $SshTarget 'bash -s'
  } finally { Remove-Item $tarTmp.FullName -Force -ErrorAction SilentlyContinue }
}

function Ship-Image {
  param([string]$SshOpts, [string]$SshTarget, [string]$ImageRef, [switch]$DryRun)
  Write-Host "-- Shipping IMAGE to $SshTarget --"
  if ($DryRun) {
    Write-Host "-> docker save $ImageRef | ssh $SshTarget 'docker load'"
    return
  }
  $tmp = New-TemporaryFile
  try {
    docker save $ImageRef -o $tmp.FullName
    if ($LASTEXITCODE -ne 0) { throw 'docker save failed' }
    Invoke-Expression "ssh $SshOpts `"$SshTarget`" 'docker load' < `"$($tmp.FullName)`""
  } finally { Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue }
}
