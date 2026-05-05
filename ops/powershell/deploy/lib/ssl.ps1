# Optional Let's Encrypt setup driven by AWS_DOMAIN.

function Invoke-SslSetup {
  param([string]$SshOpts, [string]$SshTarget, [switch]$DryRun)
  if (-not $env:AWS_DOMAIN) {
    Write-Host 'i AWS_DOMAIN not set - skipping SSL setup. (Refer to docs/INFRA/FUTURE_REQUIREMENTS.md)'
    return
  }
  Write-Host "-- Checking/Setting up SSL for $($env:AWS_DOMAIN) --"
  $remoteSsl = @"
if ! command -v certbot >/dev/null 2>&1; then
  echo '-> installing certbot'
  sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
fi
if [ ! -d "/etc/letsencrypt/live/$($env:AWS_DOMAIN)" ]; then
  echo '-> requesting new certificate for $($env:AWS_DOMAIN)'
  # sudo certbot --nginx -d $($env:AWS_DOMAIN) --non-interactive --agree-tos --email admin@$($env:AWS_DOMAIN)
else
  echo 'certificate already exists for $($env:AWS_DOMAIN)'
fi
"@
  if ($DryRun) { return }
  $remoteSsl | & ssh $SshOpts.Split(' ') $SshTarget 'bash -s'
}
