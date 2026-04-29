<#
.SYNOPSIS
  Microservice stress runner — invokes the NeoTerritory binary N times in
  parallel batches and reports wall-clock + peak working-set statistics.

.DESCRIPTION
  Why a separate runner: the C++ microservice exits per invocation (one shot
  per analysis), so server-style RPS doesn't apply. We instead measure the
  cost of repeated cold starts under concurrency, which is the production
  shape (backend spawns one process per /api/analyze call).

.PARAMETER Iterations
  Total runs.

.PARAMETER Concurrency
  Number of processes in flight at once.

.PARAMETER BinPath
  Path to the built NeoTerritory[.exe].

.PARAMETER Report
  JSON output path.

.EXAMPLE
  pwsh microservice_stress.ps1 -Iterations 100 -Concurrency 4
#>

[CmdletBinding()]
param(
    [int]    $Iterations  = 50,
    [int]    $Concurrency = 4,
    [string] $BinPath     = "",
    [string] $Report      = ""
)

$ErrorActionPreference = "Stop"

if (-not $BinPath) {
    $candidates = @(
        "$PSScriptRoot/../../../Codebase/Microservice/build/NeoTerritory.exe",
        "$PSScriptRoot/../../../Codebase/Microservice/build/NeoTerritory",
        "$PSScriptRoot/../../../Codebase/Microservice/out/build/x64-Release/NeoTerritory.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $BinPath = (Resolve-Path $c).Path; break }
    }
}
if (-not $BinPath -or -not (Test-Path $BinPath)) {
    Write-Error "NeoTerritory binary not found. Build it first or pass -BinPath."
    exit 2
}

Write-Host "Stressing: $BinPath"
Write-Host "  iterations=$Iterations concurrency=$Concurrency"

$samples = New-Object System.Collections.Generic.List[psobject]
$inFlight = New-Object System.Collections.Generic.List[psobject]

function Drain-One {
    param($list)
    $done = [System.Diagnostics.Process]::GetProcesses() | Where-Object { $false } # placeholder
    # Use Wait-Process on the first finished item via WaitAny equivalent
    while ($true) {
        for ($k = 0; $k -lt $list.Count; $k++) {
            if ($list[$k].Process.HasExited) {
                $entry = $list[$k]
                $list.RemoveAt($k)
                return $entry
            }
        }
        Start-Sleep -Milliseconds 5
    }
}

for ($i = 0; $i -lt $Iterations; $i++) {
    while ($inFlight.Count -ge $Concurrency) {
        $finished = Drain-One $inFlight
        $finished.Process.Refresh()
        $finished.Stopwatch.Stop()
        $samples.Add([pscustomobject]@{
            index    = $finished.Index
            ms       = [int]$finished.Stopwatch.Elapsed.TotalMilliseconds
            exit     = $finished.Process.ExitCode
            peak_kb  = [int]($finished.Process.PeakWorkingSet64 / 1024)
        }) | Out-Null
    }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = $BinPath
    $psi.UseShellExecute        = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    $inFlight.Add([pscustomobject]@{
        Index     = $i
        Process   = $proc
        Stopwatch = $sw
    }) | Out-Null
}

while ($inFlight.Count -gt 0) {
    $finished = Drain-One $inFlight
    $finished.Process.Refresh()
    $finished.Stopwatch.Stop()
    $samples.Add([pscustomobject]@{
        index   = $finished.Index
        ms      = [int]$finished.Stopwatch.Elapsed.TotalMilliseconds
        exit    = $finished.Process.ExitCode
        peak_kb = [int]($finished.Process.PeakWorkingSet64 / 1024)
    }) | Out-Null
}

$ok      = ($samples | Where-Object { $_.exit -eq 0 }).Count
$err     = $samples.Count - $ok
$msArr   = $samples.ms | Sort-Object
$peakArr = $samples.peak_kb | Sort-Object

function Pct($arr, $p) {
    if ($arr.Count -eq 0) { return 0 }
    $idx = [Math]::Min($arr.Count - 1, [int][Math]::Floor(($p / 100.0) * $arr.Count))
    return $arr[$idx]
}

$report = [ordered]@{
    binary       = $BinPath
    iterations   = $Iterations
    concurrency  = $Concurrency
    ok           = $ok
    errors       = $err
    wall_ms      = [ordered]@{
        min = $msArr[0]
        p50 = Pct $msArr 50
        p95 = Pct $msArr 95
        p99 = Pct $msArr 99
        max = $msArr[-1]
    }
    peak_ws_mb   = [ordered]@{
        min = [Math]::Round($peakArr[0] / 1024.0, 1)
        p50 = [Math]::Round((Pct $peakArr 50) / 1024.0, 1)
        p95 = [Math]::Round((Pct $peakArr 95) / 1024.0, 1)
        max = [Math]::Round($peakArr[-1] / 1024.0, 1)
    }
}

$report | ConvertTo-Json -Depth 5 | Tee-Object -Variable jsonOut | Write-Host
if ($Report) {
    $jsonOut | Out-File -FilePath $Report -Encoding utf8
    Write-Host "Wrote $Report"
}

if ($err -gt 0) {
    Write-Error "FAIL: $err non-zero exits"
    exit 1
}
exit 0
