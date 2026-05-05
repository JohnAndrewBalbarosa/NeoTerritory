# Coloured output helpers + a tool-existence probe.

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [xx] $msg" -ForegroundColor Red }
function Test-Tool($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
