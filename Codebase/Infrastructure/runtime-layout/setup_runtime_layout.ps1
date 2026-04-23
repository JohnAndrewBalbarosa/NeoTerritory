param(
    [string]$TargetDir = (Get-Location).Path,
    [switch]$CreatePlaceholders
)

$runtimeRoot = [System.IO.Path]::GetFullPath($TargetDir)
$inputDir = Join-Path $runtimeRoot "Input"
$outputDir = Join-Path $runtimeRoot "Output"
$analysisDir = Join-Path $outputDir "analysis_report"
$generatedCodeDir = Join-Path $outputDir "generated_code"
$htmlDir = Join-Path $outputDir "html"

$dirs = @($inputDir, $outputDir, $analysisDir, $generatedCodeDir, $htmlDir)
foreach ($dir in $dirs)
{
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$inputReadmePath = Join-Path $inputDir "README.md"
if (-not (Test-Path $inputReadmePath))
{
    @'
# NeoTerritory Input Folder

Place C/C++ source files here before running the executable.

Supported file extensions:
- .cpp
- .hpp
- .h
- .cc
- .cxx

Notes:
- The runtime scanner reads top-level files only (non-recursive).
- Output artifacts are written under ../Output.
'@ | Set-Content -Path $inputReadmePath
}

if ($CreatePlaceholders)
{
    foreach ($dir in @($analysisDir, $generatedCodeDir, $htmlDir))
    {
        $placeholder = Join-Path $dir ".gitkeep"
        if (-not (Test-Path $placeholder))
        {
            "" | Set-Content -Path $placeholder
        }
    }
}

Write-Host "Runtime layout prepared at: $runtimeRoot"
