param(
    [string]$BuildDir = "",
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$exeCandidates = @()

if ($BuildDir -ne "") {
    $resolvedBuildDir = Resolve-Path $BuildDir -ErrorAction SilentlyContinue
    if ($null -ne $resolvedBuildDir) {
        $exeCandidates += Join-Path $resolvedBuildDir "NeoTerritory.exe"
        $exeCandidates += Join-Path $resolvedBuildDir "$Configuration\NeoTerritory.exe"
    }
}

$exeCandidates += Join-Path $repoRoot "build\NeoTerritory.exe"
$exeCandidates += Join-Path $repoRoot "build\$Configuration\NeoTerritory.exe"
$exeCandidates += Join-Path $repoRoot "out\build\x64-debug\NeoTerritory.exe"
$exeCandidates += Join-Path $repoRoot "out\build\x64-release\NeoTerritory.exe"
$exeCandidates += Join-Path $repoRoot "out\build\debug\NeoTerritory.exe"
$exeCandidates += Join-Path $repoRoot "out\build\release\NeoTerritory.exe"

$sourceExe = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($null -eq $sourceExe) {
    throw "NeoTerritory.exe was not found. Build the project first, or pass -BuildDir to the folder containing the executable."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runtimeRoot = Join-Path $repoRoot "TestResults\DesignPatternTagging\$timestamp"
$inputDir = Join-Path $runtimeRoot "Input"
$outputDir = Join-Path $runtimeRoot "Output"
$runtimeExe = Join-Path $runtimeRoot "NeoTerritory.exe"

New-Item -ItemType Directory -Force -Path $inputDir | Out-Null
Copy-Item -Path $sourceExe -Destination $runtimeExe -Force
Copy-Item `
    -Path (Join-Path $repoRoot "Codebase\Microservice\Test\Input\factory_to_base_instance_source.cpp") `
    -Destination (Join-Path $inputDir "factory_to_base_instance_source.cpp") `
    -Force

& $runtimeExe factory base | Out-File -FilePath (Join-Path $runtimeRoot "stdout.txt") -Encoding utf8
if ($LASTEXITCODE -ne 0) {
    throw "NeoTerritory.exe failed with exit code $LASTEXITCODE. See $runtimeRoot\stdout.txt"
}

$reportPath = Join-Path $outputDir "analysis_report\analysis_report.json"
Assert-True (Test-Path $reportPath) "analysis_report.json should be written"

$report = Get-Content -Raw -Path $reportPath | ConvertFrom-Json
$tagTypes = @($report.design_pattern_tags | ForEach-Object { $_.tag_type })
$stageNames = @($report.stages | ForEach-Object { $_.name })

Assert-True ($report.analysis_mode -eq "design_pattern_tagging") "analysis mode should be design_pattern_tagging"
Assert-True ($report.code_generation_enabled -eq $false) "code generation should be disabled in the report"
Assert-True ([int]$report.design_pattern_tag_count -gt 0) "at least one design pattern documentation tag should be emitted"
Assert-True ($tagTypes -contains "factory_invocation") "factory invocation evidence should be tagged"
Assert-True ($tagTypes -contains "pattern_line_trace") "line-level pattern evidence should be tagged"
Assert-True ($stageNames -contains "TagDesignPatternEvidence") "tagging stage should be present"
Assert-True (-not ($stageNames -contains "GenerateMonolithicRepresentation")) "old code-generation stage should not run"
Assert-True (-not (Test-Path (Join-Path $outputDir "generated_code"))) "generated_code output directory should not be created"

Write-Host "Design-pattern tagging tests passed."
Write-Host "Runtime folder: $runtimeRoot"
