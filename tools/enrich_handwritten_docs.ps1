Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$startMarker = "<!-- AUTO-IMPLEMENTATION-STORY-START -->"
$endMarker = "<!-- AUTO-IMPLEMENTATION-STORY-END -->"

function New-MermaidBlock([string[]]$steps)
{
    $lines = New-Object 'System.Collections.Generic.List[string]'
    $lines.Add('```mermaid')
    $lines.Add("flowchart TD")
    $lines.Add("    Start([Start])")

    for ($i = 0; $i -lt $steps.Count; ++$i)
    {
        $safeLabel = $steps[$i].Replace("[", "(").Replace("]", ")").Replace('"', "'")
        $lines.Add("    N$($i)[$safeLabel]")
    }

    $lines.Add("    End([End])")

    if ($steps.Count -gt 0)
    {
        $lines.Add("    Start --> N0")
        for ($i = 0; $i -lt ($steps.Count - 1); ++$i)
        {
            $lines.Add("    N$($i) --> N$($i + 1)")
        }
        $lines.Add("    N$($steps.Count - 1) --> End")
    }
    else
    {
        $lines.Add("    Start --> End")
    }

    $lines.Add('```')
    return ($lines -join "`r`n")
}

function New-AutoSection([string]$story, [string[]]$steps)
{
    $mermaid = New-MermaidBlock $steps
    return @"
$startMarker

## Implementation Story
$story

## Activity Diagram
$mermaid

$endMarker
"@
}

function Set-AutoSection([string]$path, [string]$story, [string[]]$steps)
{
    $content = Get-Content -Path $path -Raw
    $section = New-AutoSection $story $steps

    if ($content.Contains($startMarker) -and $content.Contains($endMarker))
    {
        $pattern = [regex]::Escape($startMarker) + ".*?" + [regex]::Escape($endMarker)
        $updated = [System.Text.RegularExpressions.Regex]::Replace(
            $content,
            $pattern,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $section },
            [System.Text.RegularExpressions.RegexOptions]::Singleline)
    }
    else
    {
        $trimmed = $content.TrimEnd()
        $updated = $trimmed + "`r`n`r`n" + $section + "`r`n"
    }

    Set-Content -Path $path -Value $updated -Encoding utf8
}

$docs = @(
    @{
        Path = "docs\.github\copilot-instructions.md"
        Story = "This document shapes how implementation work should be carried out across the NeoTerritory repository. In practice it sits ahead of code changes: an agent or contributor reads these instructions first, then applies them while editing the C++ parser, the supporting backend, or the surrounding docs so the resulting implementation stays aligned with the project's architecture and coding conventions."
        Steps = @("Read the repository-wide implementation instructions", "Inspect the target module or file", "Apply changes with the documented constraints", "Validate the result against the project conventions", "Update code or docs consistently")
    }
    @{
        Path = "docs\Backend\.github\copilot-instructions.md"
        Story = "This document narrows the repository guidance down to the backend service. It influences how backend implementation work is performed by steering contributors toward the request lifecycle, middleware layering, and service boundaries already present in the Express and SQLite code."
        Steps = @("Read the backend-specific instructions", "Inspect the affected route, middleware, or controller", "Implement the backend change using the documented patterns", "Verify that the request flow still matches the backend design")
    }
    @{
        Path = "docs\Backend\README.md"
        Story = "This README explains the implemented backend as a running request pipeline. The code it describes starts in Backend/server.js, moves through Express middleware and route bindings, reaches controllers such as authController.js and transformController.js, and persists state through the SQLite setup created by initDb.js."
        Steps = @("Start the backend process", "Mount middleware and routes", "Receive health, auth, or transform requests", "Run controller logic and SQLite operations", "Return the HTTP response")
    }
    @{
        Path = "docs\Infrastructure\session-orchestration\README.md"
        Story = "This README describes the implemented environment bring-up path rather than a single function. The corresponding code lives in the PowerShell bootstrap script, the runtime-layout script, the Dockerfile, and the Kubernetes templates, and together they move the system from a bare machine to a runnable NeoTerritory session environment."
        Steps = @("Load the infrastructure configuration", "Check or install Docker, kubectl, and Minikube", "Build the runtime image", "Apply the Kubernetes templates", "Prepare the runtime folder layout")
    }
    @{
        Path = "docs\Microservice\Algorithm_Implementation.md"
        Story = "This document now maps closely to the implemented microservice pipeline. The corresponding code begins in Microservice/Layer/Back system/syntacticBrokenAST.cpp, then flows through source_reader.cpp, algorithm_pipeline.cpp, the parse-tree builders in ParseTree/core.cpp and ParseTree/Internal/build.cpp, and finally into the creational and behavioural detector modules before outputs are written."
        Steps = @("Read the discovered input files", "Build the main and shadow parse trees", "Detect creational and behavioural structure", "Generate evidence and target outputs", "Write HTML and JSON reports")
    }
    @{
        Path = "docs\Microservice\Algorithm_Plan.md"
        Story = "This planning document corresponds to the same implemented microservice pipeline but describes it from the rollout angle. The codebase currently realizes that plan through the parser, detector, evidence, and report modules in Microservice/Modules, with the application-layer runner coordinating them at execution time."
        Steps = @("Define the target source and destination patterns", "Build deterministic parse artifacts", "Separate pattern-defining evidence from neutral code", "Generate documentation and optional transformed output", "Validate the resulting artifacts")
    }
    @{
        Path = "docs\Microservice\AST_Pipeline_Step_Map.md"
        Story = "This step map is the clearest documentation mirror of the implemented parser pipeline. Each major stage in the document corresponds to concrete code in the syntactic runner, parse-tree builders, symbol-table builders, hash-link builders, and report serializer, so it effectively narrates the execution order of the microservice internals."
        Steps = @("Parse CLI and runtime context", "Build per-file main and shadow trees", "Register classes and collect hash traces", "Build symbols and hash links", "Serialize outputs and transform decisions")
    }
    @{
        Path = "docs\Microservice\Modules\Header\Behavioural\DETECTION_FORMAT.md"
        Story = "This header-oriented detection format document corresponds to the compile-time contract of the behavioural subsystem. The implementation story begins with these declarations, continues into the behavioural detector sources, and ends when the generic parser delegates behavioural structure checks through those interfaces."
        Steps = @("Include the behavioural header contracts", "Compile the behavioural detector sources against those contracts", "Delegate behavioural detection from the generic parser", "Emit behavioural tree nodes")
    }
    @{
        Path = "docs\Microservice\Modules\Header\Creational\DETECTION_FORMAT.md"
        Story = "This header-oriented detection format document corresponds to the compile-time contract of the creational subsystem. The implementation it describes starts with detector and transform declarations in the headers and then continues in the creational source files that build detector trees and perform rewrites."
        Steps = @("Include the creational header contracts", "Compile the detector and transform sources", "Delegate creational detection from the generic parser", "Emit creational tree nodes or transform results")
    }
    @{
        Path = "docs\Microservice\Modules\Source\Behavioural\DETECTION_FORMAT.md"
        Story = "This source-oriented behavioural format document corresponds directly to the behavioural implementation files. The code path it describes begins once a generic parse tree already exists, then runs the scaffold and structural checks, and finally contributes a behavioural broken-tree view back to the pipeline."
        Steps = @("Receive the generic parse tree", "Run the behavioural scaffold detector", "Run the behavioural structure checker", "Aggregate the detector results into the behavioural tree")
    }
    @{
        Path = "docs\Microservice\Modules\Source\Creational\DETECTION_FORMAT.md"
        Story = "This document corresponds to the most implementation-heavy part of the creational subsystem. The code it describes spans detector entrypoints such as creational_broken_tree.cpp, pattern logic modules for factory, singleton, and builder, and the transform pipeline that turns parse evidence into generated target or evidence views."
        Steps = @("Receive the generic parse tree and selected route", "Run factory, singleton, and builder detection", "Apply the selected creational transform rule when needed", "Render evidence or target code output", "Return transform decisions to reporting")
    }
    @{
        Path = "docs\Microservice\Test\Input\README.md"
        Story = "This README documents the regression corpus that feeds the implemented microservice. The corresponding code story starts when one of these sample files is copied into the runtime Input folder and ends when the parser, detectors, and generators produce HTML, code, and JSON outputs describing what the sample triggered."
        Steps = @("Select a sample input file", "Feed it into the Input folder or corpus list", "Run the microservice pipeline", "Inspect the generated trees, code, and report artifacts")
    }
    @{
        Path = "docs\CODEBASE_STORY.md"
        Story = "This document is itself the high-level narrative view of the implementation. It connects the infrastructure scripts, frontend prototype, backend service, and microservice pipeline into one chronological explanation so a reader can move from setup to request handling to deep C++ parsing without guessing how the pieces fit together."
        Steps = @("Start from environment setup", "Move through frontend and backend entrypoints", "Descend into the microservice execution path", "Follow parse, detect, and output generation stages", "Use the story as the reading order for the repository")
    }
    @{
        Path = "docs\COMPILED_DOCS.md"
        Story = "This document is the aggregate reference view over the rest of the markdown corpus. Its implementation story is documentary rather than executable: it gathers the important markdown files, preserves their tree order, and gives one place where the repository's code-facing guidance and design notes can be read end to end."
        Steps = @("Collect the markdown documents of interest", "Preserve their tree structure in an index", "Concatenate the document contents into one reference view", "Use the compiled document as a single-pass repository reference")
    }
    @{
        Path = "docs\CONTRIBUTING.md"
        Story = "This document corresponds to the implementation workflow around the code rather than to a runtime module. The codebase it governs is the same NeoTerritory system, and the workflow it describes determines how contributors move from an issue to a branch, into a reviewed implementation, and finally into the protected main branch."
        Steps = @("Open or triage an issue", "Create a working branch", "Implement and document the change", "Submit the pull request for review", "Merge once the change is approved and validated")
    }
    @{
        Path = "docs\SYSTEM_SPECIFICATIONS.md"
        Story = "This document corresponds to the environment requirements behind the implementation. The code it supports spans the CMake-based microservice build, the Docker and Minikube infrastructure path, and the local execution assumptions required for reproducible NeoTerritory runs."
        Steps = @("Provision the required hardware and OS", "Install the compiler and build toolchain", "Install Docker and Minikube for local orchestration", "Build and run NeoTerritory within the supported environment")
    }
)

foreach ($doc in $docs)
{
    $path = Join-Path $repoRoot $doc.Path
    if (-not (Test-Path $path))
    {
        throw ("Missing expected markdown file: {0}" -f $path)
    }

    Set-AutoSection -path $path -story $doc.Story -steps $doc.Steps
}

Write-Host ("Enriched {0} handwritten markdown files." -f $docs.Count)
