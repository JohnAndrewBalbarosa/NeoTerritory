Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$generatedDocsRoot = Join-Path $repoRoot "docs\Codebase"
$generatedOn = Get-Date -Format "yyyy-MM-dd"

$rootFiles = @(
    "CMakeLists.txt",
    "CMakeSettings.json",
    "CppProperties.json",
    "Notes",
    "setup.ps1",
    "setup.sh",
    "test.sh"
)

$sourceRoots = @(
    "Backend",
    "Frontend",
    "Infrastructure",
    "Input",
    "Microservice"
)

$allowedExtensions = @(
    ".cpp",
    ".hpp",
    ".h",
    ".js",
    ".html",
    ".css",
    ".ps1",
    ".sh",
    ".yaml",
    ".yml",
    ".json",
    ".txt"
)

$allowedNames = @(
    "CMakeLists.txt",
    "Dockerfile",
    "Notes"
)

function Get-RepoRelativePath([string]$fullPath)
{
    $relative = $fullPath.Substring($repoRoot.Length).TrimStart('\', '/')
    return $relative.Replace('\', '/')
}

function Get-DocRelativePath([string]$sourceRelativePath)
{
    switch ($sourceRelativePath)
    {
        "Microservice/Modules/Source/SyntacticBrokenAST/algorithm_pipeline.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Pipeline-Orchestration/algorithm_pipeline.cpp.md"
        }
        "Microservice/Modules/Source/SyntacticBrokenAST/cli_arguments.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Input-and-CLI/cli_arguments.cpp.md"
        }
        "Microservice/Modules/Source/SyntacticBrokenAST/source_reader.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Input-and-CLI/source_reader.cpp.md"
        }
        "Microservice/Modules/Source/SyntacticBrokenAST/codebase_output_writer.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Output-and-Rendering/codebase_output_writer.cpp.md"
        }
        "Microservice/Modules/Source/SyntacticBrokenAST/tree_html_renderer.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Output-and-Rendering/tree_html_renderer.cpp.md"
        }
        "Microservice/Modules/Source/SyntacticBrokenAST/language_tokens.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Language-and-Structure/language_tokens.cpp.md"
        }
        "Microservice/Modules/Source/SyntacticBrokenAST/lexical_structure_hooks.cpp" {
            return "Microservice/Modules/Source/SyntacticBrokenAST/Language-and-Structure/lexical_structure_hooks.cpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/algorithm_pipeline.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Pipeline-Contracts/algorithm_pipeline.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/analysis_context.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Pipeline-Contracts/analysis_context.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/cli_arguments.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Input-and-CLI/cli_arguments.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/source_reader.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Input-and-CLI/source_reader.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/codebase_output_writer.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Output-and-Rendering/codebase_output_writer.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/tree_html_renderer.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Output-and-Rendering/tree_html_renderer.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/language_tokens.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Language-and-Structure/language_tokens.hpp.md"
        }
        "Microservice/Modules/Header/SyntacticBrokenAST/lexical_structure_hooks.hpp" {
            return "Microservice/Modules/Header/SyntacticBrokenAST/Language-and-Structure/lexical_structure_hooks.hpp.md"
        }
        default {
            return $sourceRelativePath + ".md"
        }
    }
}

function Add-UniqueValue([System.Collections.Generic.List[string]]$list, [string]$value)
{
    if ([string]::IsNullOrWhiteSpace($value))
    {
        return
    }

    if (-not $list.Contains($value))
    {
        $list.Add($value)
    }
}

function Get-FileKind([string]$relativePath)
{
    $ext = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()

    switch ($ext)
    {
        ".cpp" { return "C++ implementation" }
        ".hpp" { return "C++ header" }
        ".h" { return "C/C++ header" }
        ".js" { return "JavaScript module" }
        ".html" { return "HTML view" }
        ".css" { return "CSS stylesheet" }
        ".ps1" { return "PowerShell script" }
        ".sh" { return "Shell script" }
        ".yaml" { return "YAML manifest" }
        ".yml" { return "YAML manifest" }
        ".json" { return "JSON configuration" }
        ".txt" { return "Text artifact" }
        default
        {
            switch ([System.IO.Path]::GetFileName($relativePath))
            {
                "CMakeLists.txt" { return "CMake build definition" }
                "Dockerfile" { return "Container build definition" }
                "Notes" { return "Project note" }
                default { return "Source or configuration artifact" }
            }
        }
    }
}

function Get-Role([string]$relativePath)
{
    switch -Wildcard ($relativePath)
    {
        "CMakeLists.txt" { return "Builds the NeoTerritory executable from the microservice layer and module sources." }
        "CMakeSettings.json" { return "Stores IDE-oriented CMake configuration defaults." }
        "CppProperties.json" { return "Provides editor include-path and IntelliSense settings." }
        "Notes" { return "Keeps loose repository-level notes outside the formal docs set." }
        "setup.ps1" { return "Windows bootstrap wrapper that ensures elevation and delegates to infrastructure automation." }
        "setup.sh" { return "Shell bootstrap entrypoint for non-Windows setup flows." }
        "test.sh" { return "Shell helper for local compile or execution checks." }
        "Backend/package.json" { return "Declares backend scripts and runtime dependencies." }
        "Backend/server.js" { return "Bootstraps the Express backend, middleware stack, routes, database initialization, and filesystem layout." }
        "Backend/src/controllers/*" { return "Implements HTTP endpoint behavior after routing and before response serialization." }
        "Backend/src/routes/*" { return "Maps HTTP routes to middleware and controllers." }
        "Backend/src/middleware/*" { return "Applies request-shaping concerns such as auth, uploads, and error handling." }
        "Backend/src/db/*" { return "Owns SQLite connectivity and schema initialization." }
        "Backend/src/services/*" { return "Provides backend support services used across request handlers." }
        "Backend/src/utils/*" { return "Holds small reusable backend helpers." }
        "Frontend/index.html" { return "Defines the shell document for the hash-routed frontend application." }
        "Frontend/pages/*" { return "Provides a page fragment that the client-side router injects into the main content area." }
        "Frontend/scripts/api.js" { return "Supplies mock data that feeds the current frontend experience." }
        "Frontend/scripts/router.js" { return "Drives hash routing, fragment loading, and page-init hooks." }
        "Frontend/scripts/sidebar.js" { return "Controls navigation state, mobile sidebar behavior, and theme toggling." }
        "Frontend/scripts/*" { return "Implements page-level interactive behavior for the static frontend." }
        "Frontend/styles/*" { return "Defines the visual system and component styling for the frontend prototype." }
        "Infrastructure/runtime-layout/*" { return "Creates the Input and Output directory layout expected by the microservice runtime." }
        "Infrastructure/session-orchestration/bootstrap_and_deploy.ps1" { return "Automates dependency install, Docker and Minikube startup, image build, template deployment, and runtime layout preparation." }
        "Infrastructure/session-orchestration/installer.config.json" { return "Parameterizes the infrastructure bootstrap flow with image, profile, template, and runtime-root values." }
        "Infrastructure/session-orchestration/docker/Dockerfile" { return "Builds the container image used for per-user NeoTerritory sessions." }
        "Infrastructure/session-orchestration/k8s/templates/*" { return "Declares user-scoped Kubernetes resources for session pods and routing." }
        "Input/*" { return "Provides sample source programs for manual or research-oriented runs." }
        "Microservice/main.cpp" { return "Thin executable entrypoint that delegates to the syntactic broken AST runner." }
        "Microservice/Layer/*" { return "Owns application-layer orchestration around parsing, generation, and report emission." }
        "Microservice/Modules/Header/SyntacticBrokenAST/*" { return "Declares the public interfaces and shared data types for the generic parse and analysis pipeline." }
        "Microservice/Modules/Source/SyntacticBrokenAST/*" { return "Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting." }
        "Microservice/Modules/Header/Creational/*" { return "Declares creational-pattern detection and transform interfaces." }
        "Microservice/Modules/Source/Creational/Transform/*" { return "Implements creational transform dispatch, evidence rendering, and rewrite helpers." }
        "Microservice/Modules/Source/Creational/*" { return "Implements creational pattern detection over the generic parse tree." }
        "Microservice/Modules/Header/Behavioural/*" { return "Declares behavioural detection interfaces and structural-hook contracts." }
        "Microservice/Modules/Source/Behavioural/*" { return "Implements behavioural detection and structural verification scaffolds." }
        "Microservice/Test/Input/*" { return "Supplies regression-style sample programs for microservice analysis routes." }
        default { return "Represents one source or configuration artifact in the NeoTerritory repository." }
    }
}

function Get-Chronology([string]$relativePath)
{
    switch -Wildcard ($relativePath)
    {
        "setup.ps1" { return "Usually the first Windows entrypoint: it elevates, forwards parameters, and starts infrastructure bootstrap." }
        "setup.sh" { return "Usually the first POSIX entrypoint: it starts repository setup outside the Windows path." }
        "Infrastructure/*" { return "Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared." }
        "Frontend/index.html" { return "Browser entrypoint: the user loads this shell before any route fragment or mock data is rendered." }
        "Frontend/pages/*" { return "Loaded after the router selects a route and injects the fragment into the shell document." }
        "Frontend/scripts/*" { return "Runs in the browser while the user navigates the prototype UI." }
        "Frontend/styles/*" { return "Applied during page render to define the frontend presentation layer." }
        "Backend/server.js" { return "Backend process entrypoint: it starts before any API request can reach auth or transform handlers." }
        "Backend/src/routes/*" { return "Reached after Express accepts a request and before controller logic executes." }
        "Backend/src/middleware/*" { return "Executes around route handling to validate, enrich, or reject requests." }
        "Backend/src/controllers/*" { return "Runs after routing and middleware resolution to perform request-specific backend work." }
        "Backend/src/db/*" { return "Supports backend startup and request-time persistence operations." }
        "Microservice/main.cpp" { return "Executable handoff point: it forwards control into the application-layer runner." }
        "Microservice/Layer/*" { return "Runs after process startup to validate CLI args, discover input files, execute the pipeline, and write outputs." }
        "Microservice/Modules/Source/SyntacticBrokenAST/source_reader.cpp" { return "Runs early in the microservice flow to load raw file contents before parsing begins." }
        "Microservice/Modules/Source/SyntacticBrokenAST/cli_arguments.cpp" { return "Runs at the start of the microservice flow to validate the requested source and target pattern pair." }
        "Microservice/Modules/Source/SyntacticBrokenAST/algorithm_pipeline.cpp" { return "Orchestrates the core analysis stages once source files have been loaded." }
        "Microservice/Modules/Source/SyntacticBrokenAST/*" { return "Runs across the middle of the microservice flow to build parse trees, hash links, symbol tables, reports, and rendered outputs." }
        "Microservice/Modules/Source/Creational/*" { return "Runs after the generic parse tree exists so creational detection or transformation can operate on it." }
        "Microservice/Modules/Source/Behavioural/*" { return "Runs after the generic parse tree exists so behavioural scaffolds can classify pattern structure." }
        "Input/*" { return "These files are consumed as sample inputs before or during a run rather than executed as infrastructure or service code." }
        "Microservice/Test/Input/*" { return "These files are consumed as regression corpus input during validation scenarios." }
        default { return "This artifact participates in the repository flow according to the surrounding module or toolchain that loads it." }
    }
}

function Get-Dependencies([string]$content, [string]$relativePath)
{
    $items = New-Object 'System.Collections.Generic.List[string]'
    $ext = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()
    $fileName = [System.IO.Path]::GetFileName($relativePath)

    if ($ext -in @(".cpp", ".hpp", ".h"))
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*#include\s*[<"]([^>"]+)[>"]'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($ext -eq ".js")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, 'require\(["'']([^"'']+)["'']\)'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, 'import\s+.+?\s+from\s+["'']([^"'']+)["'']'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($ext -eq ".html")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?:src|href)="([^"]+)"'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($ext -eq ".css")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '@import\s+url\(["'']?([^)"'']+)["'']?\)'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($ext -eq ".ps1")
    {
        foreach ($toolName in @("docker", "kubectl", "minikube", "winget", "wsl"))
        {
            if ($content -match ("(?i)\b" + [System.Text.RegularExpressions.Regex]::Escape($toolName) + "\b"))
            {
                Add-UniqueValue $items $toolName
            }
        }

        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '([A-Za-z0-9_\-./\\]+\.ps1)'))
        {
            Add-UniqueValue $items ($match.Groups[1].Value.Replace('\', '/'))
        }
    }
    elseif ($ext -eq ".sh")
    {
        foreach ($toolName in @("cmake", "g++", "clang++", "docker", "kubectl", "minikube"))
        {
            if ($content -match ("(?i)\b" + [System.Text.RegularExpressions.Regex]::Escape($toolName) + "\b"))
            {
                Add-UniqueValue $items $toolName
            }
        }
    }
    elseif ($fileName -eq "Dockerfile")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:FROM|COPY)\s+(.+)$'))
        {
            Add-UniqueValue $items $match.Groups[1].Value.Trim()
        }
    }

    return @($items | Select-Object -First 12)
}

function Get-KeySymbols([string]$content, [string]$relativePath)
{
    $items = New-Object 'System.Collections.Generic.List[string]'
    $ext = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()
    $fileName = [System.IO.Path]::GetFileName($relativePath)

    if ($ext -eq ".js")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\('))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*='))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($ext -in @(".cpp", ".hpp", ".h"))
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:inline\s+)?(?:constexpr\s+)?(?:static\s+)?(?:virtual\s+)?(?:[\w:<>~*&]+\s+)+([A-Za-z_][A-Za-z0-9_:]*)\s*\('))
        {
            $name = $match.Groups[1].Value
            if ($name -notin @("if", "for", "while", "switch", "return", "catch"))
            {
                Add-UniqueValue $items $name
            }
        }
    }
    elseif ($ext -eq ".ps1")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*function\s+([A-Za-z_][A-Za-z0-9_\-]*)'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '\$([A-Za-z_][A-Za-z0-9_]*)'))
        {
            Add-UniqueValue $items ("$" + $match.Groups[1].Value)
        }
    }
    elseif ($ext -eq ".html")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, 'id="([^"]+)"'))
        {
            Add-UniqueValue $items ("#" + $match.Groups[1].Value)
        }
    }
    elseif ($ext -eq ".css")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([^\r\n@][^{]+)\{'))
        {
            Add-UniqueValue $items ($match.Groups[1].Value.Trim())
        }
    }
    elseif ($ext -eq ".json")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*"([^"]+)":'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($ext -in @(".yaml", ".yml"))
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([A-Za-z0-9_\-]+):'))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }
    elseif ($fileName -eq "CMakeLists.txt")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\('))
        {
            Add-UniqueValue $items $match.Groups[1].Value
        }
    }

    return @($items | Select-Object -First 12)
}

function New-BulletLines([string[]]$items, [string]$fallback)
{
    $itemArray = @($items)
    if ((($itemArray | Measure-Object).Count) -eq 0)
    {
        return @("- $fallback")
    }

    return @($itemArray | ForEach-Object { "- " + $_ })
}

function Join-SummaryList([string[]]$items, [int]$limit = 4)
{
    $itemArray = @($items | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First $limit)
    $count = ($itemArray | Measure-Object).Count
    if ($count -eq 0)
    {
        return ""
    }
    if ($count -eq 1)
    {
        return $itemArray[0]
    }
    if ($count -eq 2)
    {
        return ($itemArray[0] + " and " + $itemArray[1])
    }

    return ((($itemArray | Select-Object -First ($count - 1)) -join ", ") + ", and " + $itemArray[$count - 1])
}

function Convert-NameToWords([string]$name)
{
    if ([string]::IsNullOrWhiteSpace($name))
    {
        return ""
    }

    $text = $name.Replace("::", " ")
    $text = $text.Replace("_", " ")
    $text = [System.Text.RegularExpressions.Regex]::Replace($text, '([a-z0-9])([A-Z])', '$1 $2')
    $text = [System.Text.RegularExpressions.Regex]::Replace($text, '\s+', ' ').Trim()
    if ([string]::IsNullOrWhiteSpace($text))
    {
        return $name
    }

    return $text.ToLowerInvariant()
}

function New-StepList()
{
    return New-Object 'System.Collections.Generic.List[string]'
}

function Add-UniqueStep([System.Collections.Generic.List[string]]$list, [string]$step)
{
    if ([string]::IsNullOrWhiteSpace($step))
    {
        return
    }

    $trimmed = $step.Trim()
    if (-not $list.Contains($trimmed))
    {
        $list.Add($trimmed)
    }
}

function Get-BraceBoundBody([string]$content, [int]$openBraceIndex)
{
    if ($openBraceIndex -lt 0 -or $openBraceIndex -ge $content.Length)
    {
        return ""
    }

    $depth = 0
    for ($i = $openBraceIndex; $i -lt $content.Length; ++$i)
    {
        $char = $content[$i]
        if ($char -eq '{')
        {
            $depth += 1
        }
        elseif ($char -eq '}')
        {
            $depth -= 1
            if ($depth -eq 0)
            {
                return $content.Substring($openBraceIndex + 1, $i - $openBraceIndex - 1)
            }
        }
    }

    return ""
}

function Get-JSFunctionInfo([string]$content)
{
    $results = New-Object 'System.Collections.Generic.List[object]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $patterns = @(
        '(?m)^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(',
        '(?m)^\s*(?:export\s+)?const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:function\s*\(|\([^)]*\)\s*=>|[A-Za-z_][A-Za-z0-9_]*\s*=>)',
        '(?m)^\s*(?:export\s+)?let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:function\s*\(|\([^)]*\)\s*=>|[A-Za-z_][A-Za-z0-9_]*\s*=>)',
        '(?m)^\s*(?:export\s+)?var\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:function\s*\(|\([^)]*\)\s*=>|[A-Za-z_][A-Za-z0-9_]*\s*=>)'
    )

    foreach ($pattern in $patterns)
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, $pattern))
        {
            $name = $match.Groups[1].Value
            if ([string]::IsNullOrWhiteSpace($name) -or $seen.Contains($name))
            {
                continue
            }

            $braceIndex = $content.IndexOf('{', $match.Index)
            if ($braceIndex -lt 0)
            {
                continue
            }

            $body = Get-BraceBoundBody $content $braceIndex
            $null = $seen.Add($name)
            $results.Add([PSCustomObject]@{
                Name = $name
                Body = $body
            })
        }
    }

    return $results.ToArray()
}

function Get-CppFunctionInfo([string]$content)
{
    $results = New-Object 'System.Collections.Generic.List[object]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $pattern = '(?m)^\s*(?!if\b|for\b|while\b|switch\b|catch\b|return\b)(?:template\s*<[^>]+>\s*)?(?:inline\s+)?(?:static\s+)?(?:virtual\s+)?(?:constexpr\s+)?(?:[\w:<>~*&]+\s+)+([A-Za-z_~][A-Za-z0-9_:~]*)\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?\{'

    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, $pattern))
    {
        $name = $match.Groups[1].Value
        if ([string]::IsNullOrWhiteSpace($name) -or $seen.Contains($name))
        {
            continue
        }

        $braceIndex = $content.IndexOf('{', $match.Index)
        if ($braceIndex -lt 0)
        {
            continue
        }

        $body = Get-BraceBoundBody $content $braceIndex
        $null = $seen.Add($name)
        $results.Add([PSCustomObject]@{
            Name = $name
            Body = $body
        })
    }

    return $results.ToArray()
}

function Get-PowerShellFunctionNames([string]$content)
{
    $names = New-Object 'System.Collections.Generic.List[string]'
    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*function\s+([A-Za-z_][A-Za-z0-9_\-]*)'))
    {
        Add-UniqueStep $names $match.Groups[1].Value
    }
    return @($names)
}

function Get-HeaderDeclarations([string]$content)
{
    $items = New-StepList
    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)'))
    {
        Add-UniqueStep $items ("Declare " + $match.Groups[1].Value)
    }
    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(?:[\w:<>~*&]+\s+)+([A-Za-z_~][A-Za-z0-9_:~]*)\s*\([^;{}]*\)\s*;'))
    {
        $name = $match.Groups[1].Value
        if ($name -in @("if", "for", "while", "switch", "catch", "return"))
        {
            continue
        }
        Add-UniqueStep $items ("Declare " + $name)
    }
    return @($items | Select-Object -First 6)
}

function Get-JSOperationPhrases([string]$body)
{
    $ops = New-StepList
    if ($body -match 'if\s*\(') { Add-UniqueStep $ops "validate conditions and branch on failures" }
    if ($body -match 'db\.prepare|db\.[A-Za-z_]') { Add-UniqueStep $ops "query or update SQLite state" }
    if ($body -match 'bcrypt\.(hash|compare)') { Add-UniqueStep $ops "hash or compare credentials" }
    if ($body -match 'jwt\.(sign|verify)') { Add-UniqueStep $ops "sign or verify JWT tokens" }
    if ($body -match 'fs\.[A-Za-z_]+') { Add-UniqueStep $ops "move or write filesystem artifacts" }
    if ($body -match 'fetch\s*\(') { Add-UniqueStep $ops "fetch route or page content" }
    if ($body -match 'document\.|querySelector|getElementById|innerHTML|textContent|style\.') { Add-UniqueStep $ops "update DOM state" }
    if ($body -match 'addEventListener') { Add-UniqueStep $ops "bind browser event listeners" }
    if ($body -match 'localStorage') { Add-UniqueStep $ops "persist browser state" }
    if ($body -match 'setTimeout|setInterval|requestAnimationFrame') { Add-UniqueStep $ops "schedule UI updates" }
    if ($body -match 'location\.hash|navigate\s*\(') { Add-UniqueStep $ops "change the active route" }
    if ($body -match 'res\.status|res\.json|res\.send') { Add-UniqueStep $ops "return the HTTP response" }
    if ($body -match 'module\.exports|export\s') { Add-UniqueStep $ops "expose the module API" }
    return @($ops)
}

function Get-CppOperationPhrases([string]$body)
{
    $ops = New-StepList
    if ($body -match 'std::ifstream|ifstream|rdbuf\(') { Add-UniqueStep $ops "read source or input files" }
    if ($body -match 'std::ofstream|ofstream|write_text_file|Set-Content') { Add-UniqueStep $ops "write generated artifacts" }
    if ($body -match 'create_directories|directory_iterator|exists\(|current_path|absolute\(') { Add-UniqueStep $ops "inspect or prepare filesystem paths" }
    if ($body -match 'tokenize|split_lines|parse_|read_source') { Add-UniqueStep $ops "parse or tokenize input text" }
    if ($body -match 'build_|push_back|children|append_') { Add-UniqueStep $ops "assemble tree or artifact structures" }
    if ($body -match 'hash|contextual_hash|fnv1a64') { Add-UniqueStep $ops "compute hash metadata" }
    if ($body -match 'render_|to_html|to_text') { Add-UniqueStep $ops "render text or HTML views" }
    if ($body -match 'json|ostringstream|append_json') { Add-UniqueStep $ops "serialize report content" }
    if ($body -match 'validate_|graph_consistent|failure') { Add-UniqueStep $ops "validate pipeline invariants" }
    if ($body -match 'generate_') { Add-UniqueStep $ops "generate code or evidence output" }
    if ($body -match 'for\s*\(|while\s*\(') { Add-UniqueStep $ops "iterate over the active collection" }
    if ($body -match 'if\s*\(') { Add-UniqueStep $ops "branch on runtime conditions" }
    return @($ops)
}

function Get-PathStemTokens([string]$relativePath)
{
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($relativePath)
    $tokens = New-StepList
    foreach ($token in (Convert-NameToWords $stem).Split(' '))
    {
        if ($token.Length -ge 3)
        {
            Add-UniqueStep $tokens $token
        }
    }
    return @($tokens)
}

function Get-FunctionPriorityScore([string]$name, [string]$body, [string[]]$pathTokens, [string]$language)
{
    $score = 0
    $lowerName = $name.ToLowerInvariant()

    foreach ($token in $pathTokens)
    {
        if (-not [string]::IsNullOrWhiteSpace($token) -and $lowerName.Contains($token))
        {
            $score += 20
        }
    }

    foreach ($prefix in @("run_", "build_", "generate_", "write_", "parse_", "read_", "render_", "resolve_", "collect_", "create_", "init_", "transform_", "register_", "login", "navigate", "initrouter", "start"))
    {
        if ($lowerName.StartsWith($prefix))
        {
            $score += 25
            break
        }
    }

    foreach ($prefix in @("estimate_", "append_", "json_escape", "file_has_", "trim_", "clear_", "usage_hash_", "token_is_"))
    {
        if ($lowerName.StartsWith($prefix))
        {
            $score -= 20
            break
        }
    }

    if ($body.Length -gt 1200) { $score += 20 }
    elseif ($body.Length -gt 400) { $score += 12 }
    elseif ($body.Length -gt 120) { $score += 6 }

    if ($language -eq "cpp")
    {
        if ($body -match 'return\s+[A-Za-z_].+\(') { $score += 4 }
        if ($body -match 'for\s*\(|while\s*\(') { $score += 4 }
        if ($body -match 'if\s*\(') { $score += 2 }
    }
    elseif ($language -eq "js")
    {
        if ($body -match 'res\.status|res\.json|fetch\s*\(|document\.|addEventListener') { $score += 6 }
        if ($body -match 'if\s*\(') { $score += 2 }
    }

    return $score
}

function Get-ActivityStepsFromCode([string]$relativePath, [string]$content)
{
    $ext = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()
    $fileName = [System.IO.Path]::GetFileName($relativePath)
    $steps = New-StepList
    $pathTokens = Get-PathStemTokens $relativePath

    if ($ext -eq ".js")
    {
        $functions = Get-JSFunctionInfo $content | ForEach-Object {
            [PSCustomObject]@{
                Name = $_.Name
                Body = $_.Body
                Score = Get-FunctionPriorityScore $_.Name $_.Body $pathTokens "js"
            }
        } | Sort-Object -Property @{Expression={$_.Score};Descending=$true}, @{Expression={$_.Body.Length};Descending=$true}

        foreach ($function in ($functions | Select-Object -First 5))
        {
            $ops = Get-JSOperationPhrases $function.Body
            $summary = Join-SummaryList $ops 3
            if ([string]::IsNullOrWhiteSpace($summary))
            {
                Add-UniqueStep $steps ("Run " + $function.Name + "()")
            }
            else
            {
                Add-UniqueStep $steps ("Run " + $function.Name + "() to " + $summary)
            }
        }
    }
    elseif ($ext -in @(".cpp", ".cc", ".cxx"))
    {
        $functions = Get-CppFunctionInfo $content | ForEach-Object {
            [PSCustomObject]@{
                Name = $_.Name
                Body = $_.Body
                Score = Get-FunctionPriorityScore $_.Name $_.Body $pathTokens "cpp"
            }
        } | Sort-Object -Property @{Expression={$_.Score};Descending=$true}, @{Expression={$_.Body.Length};Descending=$true}

        foreach ($function in ($functions | Select-Object -First 5))
        {
            $ops = Get-CppOperationPhrases $function.Body
            $summary = Join-SummaryList $ops 3
            $humanName = Convert-NameToWords $function.Name
            if ([string]::IsNullOrWhiteSpace($summary))
            {
                Add-UniqueStep $steps ("Execute " + $humanName)
            }
            else
            {
                Add-UniqueStep $steps ("Execute " + $humanName + " to " + $summary)
            }
        }
    }
    elseif ($ext -in @(".hpp", ".h"))
    {
        foreach ($declaration in (Get-HeaderDeclarations $content))
        {
            Add-UniqueStep $steps $declaration
        }
    }
    elseif ($ext -eq ".ps1")
    {
        foreach ($name in (Get-PowerShellFunctionNames $content | Select-Object -First 6))
        {
            $human = Convert-NameToWords $name
            Add-UniqueStep $steps ("Run " + $human)
        }
        if ($content -match '\bdocker\b') { Add-UniqueStep $steps "Call Docker tooling when container steps are required" }
        if ($content -match '\bminikube\b') { Add-UniqueStep $steps "Start or repair the Minikube profile when cluster mode is enabled" }
        if ($content -match '\bkubectl\b') { Add-UniqueStep $steps "Apply or inspect Kubernetes resources through kubectl" }
    }
    elseif ($ext -eq ".sh")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{'))
        {
            $human = Convert-NameToWords $match.Groups[1].Value
            Add-UniqueStep $steps ("Run " + $human)
        }
        foreach ($tool in @("cmake", "g++", "clang++", "docker", "kubectl", "minikube"))
        {
            if ($content -match ("(?i)\b" + [System.Text.RegularExpressions.Regex]::Escape($tool) + "\b"))
            {
                Add-UniqueStep $steps ("Invoke " + $tool)
            }
        }
    }
    elseif ($ext -eq ".html")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, 'id="([^"]+)"'))
        {
            Add-UniqueStep $steps ("Render #" + $match.Groups[1].Value)
        }
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '<script[^>]+src="([^"]+)"'))
        {
            Add-UniqueStep $steps ("Load script " + $match.Groups[1].Value)
        }
    }
    elseif ($ext -eq ".css")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([^\r\n@][^{]+)\{'))
        {
            $selector = $match.Groups[1].Value.Trim()
            Add-UniqueStep $steps ("Style " + $selector)
        }
    }
    elseif ($ext -eq ".json")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*"([^"]+)":'))
        {
            Add-UniqueStep $steps ("Define " + $match.Groups[1].Value)
        }
    }
    elseif ($ext -in @(".yaml", ".yml"))
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([A-Za-z0-9_\-]+):'))
        {
            Add-UniqueStep $steps ("Declare " + $match.Groups[1].Value)
        }
    }
    elseif ($fileName -eq "CMakeLists.txt")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\('))
        {
            Add-UniqueStep $steps ("Call CMake command " + $match.Groups[1].Value)
        }
    }
    elseif ($fileName -eq "Dockerfile")
    {
        foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, '(?m)^\s*(FROM|RUN|COPY|CMD|ENTRYPOINT)\s+(.+)$'))
        {
            Add-UniqueStep $steps (($match.Groups[1].Value.ToUpperInvariant()) + " " + $match.Groups[2].Value.Trim())
        }
    }

    return @($steps | Select-Object -First 6)
}

function Get-LogicalGroup([string]$relativePath)
{
    switch -Wildcard ($relativePath)
    {
        "Backend/server.js" { return "Runtime Entrypoints" }
        "Backend/package.json" { return "Runtime Configuration" }
        "Backend/src/controllers/*" { return "Controllers" }
        "Backend/src/routes/*" { return "Routes" }
        "Backend/src/middleware/*" { return "Middleware" }
        "Backend/src/db/*" { return "Data Layer" }
        "Backend/src/services/*" { return "Services" }
        "Backend/src/utils/*" { return "Utilities" }

        "Frontend/index.html" { return "Shell Entrypoints" }
        "Frontend/pages/*" { return "Pages" }
        "Frontend/scripts/*" { return "Browser Logic" }
        "Frontend/styles/*" { return "Styling" }

        "Infrastructure/runtime-layout/*" { return "Runtime Layout" }
        "Infrastructure/session-orchestration/docker/*" { return "Container Assets" }
        "Infrastructure/session-orchestration/k8s/*" { return "Kubernetes Manifests" }
        "Infrastructure/session-orchestration/*" { return "Bootstrap Orchestration" }

        "Input/*" { return "Sample Inputs" }

        "Microservice/main.cpp" { return "Executable Entrypoints" }
        "Microservice/Layer/*" { return "Application Runner" }
        "Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/Internal/*" { return "ParseTree Internal Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/*" { return "ParseTree Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/Internal/*" { return "Internal Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/*" { return "Syntactic Interfaces" }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/*" { return "ParseTree Internals" }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/*" { return "ParseTree Engine" }
        "Microservice/Modules/Source/SyntacticBrokenAST/*" { return "Syntactic Pipeline" }
        "Microservice/Modules/Header/Creational/Transform/*" { return "Creational Transform Contracts" }
        "Microservice/Modules/Header/Creational/Logic/*" { return "Creational Logic Contracts" }
        "Microservice/Modules/Header/Creational/*" { return "Creational Interfaces" }
        "Microservice/Modules/Source/Creational/Transform/internal/*" { return "Creational Transform Internals" }
        "Microservice/Modules/Source/Creational/Transform/*" { return "Creational Transform Pipeline" }
        "Microservice/Modules/Source/Creational/Logic/*" { return "Creational Logic" }
        "Microservice/Modules/Source/Creational/*" { return "Creational Detection" }
        "Microservice/Modules/Header/Behavioural/Logic/*" { return "Behavioural Logic Contracts" }
        "Microservice/Modules/Header/Behavioural/*" { return "Behavioural Interfaces" }
        "Microservice/Modules/Source/Behavioural/Logic/*" { return "Behavioural Logic" }
        "Microservice/Modules/Source/Behavioural/*" { return "Behavioural Detection" }
        "Microservice/Test/Input/*" { return "Regression Inputs" }

        "CMakeLists.txt" { return "Build System" }
        "CMakeSettings.json" { return "Build System" }
        "CppProperties.json" { return "Editor Configuration" }
        "setup.ps1" { return "Bootstrap Scripts" }
        "setup.sh" { return "Bootstrap Scripts" }
        "test.sh" { return "Validation Scripts" }
        "Notes" { return "Project Notes" }

        default { return "General Artifacts" }
    }
}

function Get-FolderLogicSummary([string]$folderRelativePath)
{
    switch -Wildcard ($folderRelativePath)
    {
        "" { return "Top-level logical view of the generated codebase mirror. It groups the repository into runtime entrypoints, frontend prototype code, backend service code, infrastructure automation, sample inputs, and the C++ microservice core." }
        "Backend" { return "Backend service surface. This area groups the Express entrypoint, package metadata, and the HTTP runtime internals under src." }
        "Backend/src" { return "Backend internals grouped by request flow. Routing directs requests into middleware, then controllers, with database, service, and utility helpers supporting the work." }
        "Backend/src/controllers" { return "Controller layer for concrete backend request handling after routing and middleware have finished preliminary work." }
        "Backend/src/routes" { return "Route layer that maps URL paths to middleware chains and controller entrypoints." }
        "Backend/src/middleware" { return "Cross-cutting backend request logic such as auth, upload handling, and error shaping." }
        "Backend/src/db" { return "SQLite-oriented persistence helpers and schema initialization logic." }
        "Backend/src/services" { return "Reusable backend support services called from controllers or middleware." }
        "Backend/src/utils" { return "Small backend utilities used to keep the request handlers concise." }

        "Frontend" { return "Frontend prototype shell. This area groups the browser entrypoint with route fragments, scripts, and styles." }
        "Frontend/pages" { return "Route-sized HTML fragments loaded by the client router." }
        "Frontend/scripts" { return "Browser logic that powers routing, UI state changes, mock data usage, and page interactions." }
        "Frontend/styles" { return "Visual system and component styling for the prototype frontend." }

        "Infrastructure" { return "Infrastructure automation and runtime environment assembly for local containerized execution." }
        "Infrastructure/runtime-layout" { return "Scripts that create the filesystem layout expected by the executable runtime." }
        "Infrastructure/session-orchestration" { return "Session bootstrap logic that prepares Docker, Minikube, runtime images, templates, and runtime folders." }
        "Infrastructure/session-orchestration/docker" { return "Container image definitions used by the orchestration bootstrap." }
        "Infrastructure/session-orchestration/k8s" { return "Kubernetes deployment-side assets for user-scoped runtime sessions." }
        "Infrastructure/session-orchestration/k8s/templates" { return "Parameterized Kubernetes manifests rendered and applied by the bootstrap process." }

        "Input" { return "Top-level sample source files used as manual or research-oriented inputs for the microservice." }

        "Microservice" { return "C++ executable and module tree that implement the parser, detector, transform, rendering, and report pipeline." }
        "Microservice/Layer" { return "Application-layer orchestration around the deeper module code." }
        "Microservice/Layer/Back system" { return "The runtime runner that ties CLI parsing, file discovery, pipeline execution, and output writing together." }
        "Microservice/Modules" { return "Modularized C++ implementation divided into compile-time headers and source implementations." }
        "Microservice/Modules/Header" { return "Header contracts grouped by subsystem." }
        "Microservice/Modules/Header/SyntacticBrokenAST" { return "Generic parser and analysis interfaces shared across the microservice." }
        "Microservice/Modules/Header/SyntacticBrokenAST/Pipeline-Contracts" { return "Pipeline-level contracts for reports, shared context, and orchestration-facing syntactic types." }
        "Microservice/Modules/Header/SyntacticBrokenAST/Input-and-CLI" { return "Contracts that describe how source files enter the syntactic subsystem and how command input is represented." }
        "Microservice/Modules/Header/SyntacticBrokenAST/Output-and-Rendering" { return "Contracts for output writing and visual rendering of generated syntactic artifacts." }
        "Microservice/Modules/Header/SyntacticBrokenAST/Language-and-Structure" { return "Contracts for token vocabulary and structural keyword hooks used during parsing." }
        "Microservice/Modules/Header/SyntacticBrokenAST/Internal" { return "Internal header contracts supporting the syntactic subsystem." }
        "Microservice/Modules/Header/SyntacticBrokenAST/ParseTree" { return "Public parse-tree contracts and helper interfaces." }
        "Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/Internal" { return "Private parse-tree implementation contracts used by the C++ sources." }
        "Microservice/Modules/Header/Creational" { return "Creational detection and transform interface layer." }
        "Microservice/Modules/Header/Creational/Builder" { return "Builder-pattern specific contract layer." }
        "Microservice/Modules/Header/Creational/Factory" { return "Factory-pattern specific contract layer." }
        "Microservice/Modules/Header/Creational/Logic" { return "Creational logic and keyword-resolution contracts." }
        "Microservice/Modules/Header/Creational/Singleton" { return "Singleton-pattern specific contract layer." }
        "Microservice/Modules/Header/Creational/Transform" { return "Creational transform and evidence-rendering contracts." }
        "Microservice/Modules/Header/Behavioural" { return "Behavioural detection interface layer." }
        "Microservice/Modules/Header/Behavioural/Logic" { return "Behavioural logic and structural-hook contracts." }

        "Microservice/Modules/Source" { return "C++ source implementations grouped by subsystem." }
        "Microservice/Modules/Source/SyntacticBrokenAST" { return "Generic syntactic pipeline services such as CLI parsing, source reading, lexical hooks, generation, and reporting." }
        "Microservice/Modules/Source/SyntacticBrokenAST/Pipeline-Orchestration" { return "Top-level pipeline orchestration and report-shaping code for the syntactic subsystem." }
        "Microservice/Modules/Source/SyntacticBrokenAST/Input-and-CLI" { return "Input discovery, source loading, and command-argument handling for the syntactic subsystem." }
        "Microservice/Modules/Source/SyntacticBrokenAST/Output-and-Rendering" { return "Generated artifact writing and HTML/text rendering helpers for syntactic outputs." }
        "Microservice/Modules/Source/SyntacticBrokenAST/Language-and-Structure" { return "Language token definitions and structural hook logic that guide pattern-aware parsing." }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree" { return "Parse-tree engine implementation for building, linking, symbolizing, and rendering the tree artifacts." }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal" { return "Private parse-tree implementation helpers used by the engine internals." }
        "Microservice/Modules/Source/Creational" { return "Creational pattern detection and transform implementation over the generic parse tree." }
        "Microservice/Modules/Source/Creational/Builder" { return "Builder-pattern specific detection logic." }
        "Microservice/Modules/Source/Creational/Factory" { return "Factory-pattern specific detection logic." }
        "Microservice/Modules/Source/Creational/Logic" { return "Shared creational logic helpers and keyword providers." }
        "Microservice/Modules/Source/Creational/Singleton" { return "Singleton-pattern specific detection logic." }
        "Microservice/Modules/Source/Creational/Transform" { return "Creational transform execution and evidence rendering pipeline." }
        "Microservice/Modules/Source/Creational/Transform/internal" { return "Internal helpers used by the creational transform pipeline." }
        "Microservice/Modules/Source/Behavioural" { return "Behavioural pattern detection implementation." }
        "Microservice/Modules/Source/Behavioural/Logic" { return "Behavioural scaffolding and structural-hook implementation helpers." }
        "Microservice/Test" { return "Validation-oriented source corpus and test support assets." }
        "Microservice/Test/Input" { return "Regression-focused input programs used to exercise specific transform and detection routes." }

        default { return "Logical grouping index for this part of the generated codebase mirror." }
    }
}

function Get-FolderGroup([string]$folderRelativePath)
{
    switch -Wildcard ($folderRelativePath)
    {
        "Backend" { return "Backend Service" }
        "Backend/src" { return "Backend Internals" }
        "Backend/src/controllers" { return "Controllers" }
        "Backend/src/routes" { return "Routes" }
        "Backend/src/middleware" { return "Middleware" }
        "Backend/src/db" { return "Data Layer" }
        "Backend/src/services" { return "Services" }
        "Backend/src/utils" { return "Utilities" }

        "Frontend" { return "Frontend Prototype" }
        "Frontend/pages" { return "Pages" }
        "Frontend/scripts" { return "Browser Logic" }
        "Frontend/styles" { return "Styling" }

        "Infrastructure" { return "Infrastructure Automation" }
        "Infrastructure/runtime-layout" { return "Runtime Layout" }
        "Infrastructure/session-orchestration" { return "Session Orchestration" }
        "Infrastructure/session-orchestration/docker" { return "Container Assets" }
        "Infrastructure/session-orchestration/k8s" { return "Kubernetes Assets" }
        "Infrastructure/session-orchestration/k8s/templates" { return "Kubernetes Manifests" }

        "Input" { return "Sample Inputs" }

        "Microservice" { return "Microservice Core" }
        "Microservice/Layer" { return "Application Runner" }
        "Microservice/Layer/Back system" { return "Runtime Runner" }
        "Microservice/Modules" { return "Module Tree" }
        "Microservice/Modules/Header" { return "Header Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST" { return "Syntactic Interfaces" }
        "Microservice/Modules/Header/SyntacticBrokenAST/Pipeline-Contracts" { return "Pipeline Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/Input-and-CLI" { return "Input And CLI Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/Output-and-Rendering" { return "Output And Rendering Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/Language-and-Structure" { return "Language And Structure Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/Internal" { return "Internal Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/ParseTree" { return "ParseTree Contracts" }
        "Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/Internal" { return "ParseTree Internal Contracts" }
        "Microservice/Modules/Header/Creational" { return "Creational Interfaces" }
        "Microservice/Modules/Header/Creational/Builder" { return "Builder Contracts" }
        "Microservice/Modules/Header/Creational/Factory" { return "Factory Contracts" }
        "Microservice/Modules/Header/Creational/Logic" { return "Creational Logic Contracts" }
        "Microservice/Modules/Header/Creational/Singleton" { return "Singleton Contracts" }
        "Microservice/Modules/Header/Creational/Transform" { return "Creational Transform Contracts" }
        "Microservice/Modules/Header/Behavioural" { return "Behavioural Interfaces" }
        "Microservice/Modules/Header/Behavioural/Logic" { return "Behavioural Logic Contracts" }
        "Microservice/Modules/Source" { return "Source Implementations" }
        "Microservice/Modules/Source/SyntacticBrokenAST" { return "Syntactic Pipeline" }
        "Microservice/Modules/Source/SyntacticBrokenAST/Pipeline-Orchestration" { return "Pipeline Orchestration" }
        "Microservice/Modules/Source/SyntacticBrokenAST/Input-and-CLI" { return "Input And CLI" }
        "Microservice/Modules/Source/SyntacticBrokenAST/Output-and-Rendering" { return "Output And Rendering" }
        "Microservice/Modules/Source/SyntacticBrokenAST/Language-and-Structure" { return "Language And Structure" }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree" { return "ParseTree Engine" }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal" { return "ParseTree Internals" }
        "Microservice/Modules/Source/Creational" { return "Creational Detection" }
        "Microservice/Modules/Source/Creational/Builder" { return "Builder Logic" }
        "Microservice/Modules/Source/Creational/Factory" { return "Factory Logic" }
        "Microservice/Modules/Source/Creational/Logic" { return "Creational Logic" }
        "Microservice/Modules/Source/Creational/Singleton" { return "Singleton Logic" }
        "Microservice/Modules/Source/Creational/Transform" { return "Creational Transform Pipeline" }
        "Microservice/Modules/Source/Creational/Transform/internal" { return "Creational Transform Internals" }
        "Microservice/Modules/Source/Behavioural" { return "Behavioural Detection" }
        "Microservice/Modules/Source/Behavioural/Logic" { return "Behavioural Logic" }
        "Microservice/Test" { return "Validation Assets" }
        "Microservice/Test/Input" { return "Regression Inputs" }

        default { return "Subsystems" }
    }
}

function New-FolderReadme(
    [string]$folderRelativePath,
    [object[]]$immediateChildDirs,
    [object[]]$immediateFiles,
    [int]$totalDescendantFiles)
{
    $childDirArray = @($immediateChildDirs)
    $fileArray = @($immediateFiles)
    $title = if ([string]::IsNullOrWhiteSpace($folderRelativePath)) { "Codebase Mirror" } else { [System.IO.Path]::GetFileName($folderRelativePath) }
    $summary = Get-FolderLogicSummary $folderRelativePath

    $lines = New-Object 'System.Collections.Generic.List[string]'
    $lines.Add("# $title")
    $lines.Add("")
    if ([string]::IsNullOrWhiteSpace($folderRelativePath))
    {
        $lines.Add("- Folder: docs/Codebase")
    }
    else
    {
        $lines.Add("- Folder: docs/Codebase/$folderRelativePath")
    }
    $lines.Add("- Descendant source docs: $totalDescendantFiles")
    $lines.Add("- Generated on: $generatedOn")
    $lines.Add("")
    $lines.Add("## Logic Summary")
    $lines.Add($summary)
    $lines.Add("")

    if ((($childDirArray | Measure-Object).Count) -gt 0)
    {
        $lines.Add("## Child Folders By Logic")
        foreach ($group in ($childDirArray | Group-Object Group | Sort-Object Name))
        {
            $lines.Add("### $($group.Name)")
            foreach ($item in ($group.Group | Sort-Object Name))
            {
                $lines.Add("- $($item.Name)/ : $($item.Summary)")
            }
            $lines.Add("")
        }
    }

    if ((($fileArray | Measure-Object).Count) -gt 0)
    {
        $lines.Add("## Documents By Logic")
        foreach ($group in ($fileArray | Group-Object Group | Sort-Object Name))
        {
            $lines.Add("### $($group.Name)")
            foreach ($item in ($group.Group | Sort-Object Name))
            {
                $lines.Add("- $($item.DocName) : $($item.Role)")
            }
            $lines.Add("")
        }
    }

    $lines.Add("## Reading Hint")
    if ((($childDirArray | Measure-Object).Count) -gt 0 -and (($fileArray | Measure-Object).Count) -gt 0)
    {
        $lines.Add("- Read the local file docs first for concrete behavior, then descend into the child folders for narrower subsystem details.")
    }
    elseif ((($fileArray | Measure-Object).Count) -gt 0)
    {
        $lines.Add("- This folder is mostly leaf-level. Read the local file docs to understand the logic in this area.")
    }
    else
    {
        $lines.Add("- Use the child folder groups to navigate deeper into this subsystem.")
    }

    return ($lines -join "`r`n") + "`r`n"
}

function Get-ImplementationStory(
    [string]$relativePath,
    [string]$role,
    [string]$chronology,
    [string[]]$symbols,
    [string[]]$dependencies)
{
    $baseStory = switch -Wildcard ($relativePath)
    {
        "setup.ps1" { "This script is the Windows bootstrap doorway for the repository. Its implementation checks for Administrator privileges, relaunches when elevation is required, preserves incoming parameters, and then hands control to the infrastructure bootstrap so the environment is ready before any service or executable is run." }
        "setup.sh" { "This script is the shell-side repository bootstrap entrypoint. Its implementation exists to prepare or delegate the non-Windows setup path before the rest of the toolchain is used." }
        "test.sh" { "This script acts as a quick validation entrypoint. Its implementation is part of the lightweight outer loop around the codebase, helping the repository move from setup to verification." }
        "CMakeLists.txt" { "This file is the compile-time assembly point for the C++ system. Its implementation chooses compiler defaults, sets the language standard, gathers microservice sources and headers, and then binds them into the single NeoTerritory executable with the include paths the parser and pattern modules expect." }
        "Backend/server.js" { "This file is the backend runtime bootstrapper. Its implementation loads environment configuration, creates the working directories used for uploads and outputs, mounts the security and routing middleware stack, initializes the SQLite schema, and finally opens the HTTP listener." }
        "Backend/src/controllers/authController.js" { "This controller implements the authentication story of the backend. It receives registration or login payloads, validates the required fields, queries the database, hashes or compares credentials, records audit logs, and returns either a JWT or an error response." }
        "Backend/src/controllers/transformController.js" { "This controller implements the current upload-to-placeholder-transform path. It validates the uploaded file, normalizes and relocates the input, creates an output placeholder, persists a job record, writes log entries, and returns the job metadata to the caller." }
        "Backend/src/routes/*" { "This route file is a traffic director rather than a business-logic endpoint. Its implementation wires HTTP verbs and paths to the middleware chain and then forwards the request into the controller that performs the real work." }
        "Backend/src/middleware/jwtAuth.js" { "This middleware implements the authentication gate in front of protected backend routes. It inspects the Authorization header, verifies the bearer token, attaches the decoded user identity on success, and short-circuits the request with a 401 response on failure." }
        "Backend/src/middleware/upload.js" { "This middleware implements the upload acceptance boundary. It configures how incoming files are received and normalized before controller code tries to use them." }
        "Backend/src/middleware/*" { "This middleware file shapes request flow before or after controller logic. Its implementation exists to enforce cross-cutting policy around validation, security, request data handling, or error formatting." }
        "Backend/src/db/initDb.js" { "This file implements the database bootstrapping sequence. It creates the users, jobs, and logs tables if they do not already exist so the backend can start in a valid persistence state." }
        "Backend/src/db/*" { "This file lives in the persistence layer of the backend. Its implementation supports startup-time or request-time SQLite operations used by the HTTP layer." }
        "Backend/src/services/*" { "This service file implements reusable backend support logic. Its implementation is called from controllers or middleware so those layers can stay focused on request flow." }
        "Backend/src/utils/*" { "This utility file implements small backend helpers that keep request handlers and services from repeating low-level logic." }
        "Backend/package.json" { "This manifest tells the backend runtime how to start and what to load. Its implementation role is declarative: it defines the executable scripts and package dependencies that make the Express service run." }
        "Frontend/index.html" { "This file is the shell document for the frontend prototype. Its implementation lays out the persistent frame of the application, loads the shared styles and scripts, and then starts the router and sidebar logic that populate the page." }
        "Frontend/scripts/router.js" { "This file implements the client-side route transition loop. It reads the current hash, resolves the matching page fragment, fetches it, injects it into the shell, updates the nav state, and triggers page-specific initialization hooks." }
        "Frontend/scripts/sidebar.js" { "This file implements navigation chrome behavior around the SPA shell. It wires sidebar open and close actions, route clicks, theme persistence, and responsive cleanup so the shared layout stays coherent while pages change." }
        "Frontend/scripts/analysis.js" { "This file implements the staged-analysis demo flow on the frontend. It reacts to the start button, swaps ready and progress states, animates the progress bars, and navigates to the results view when the simulated pipeline finishes." }
        "Frontend/scripts/api.js" { "This file implements the mock-data contract for the current frontend. Instead of calling a live backend, the pages pull their dashboard, diff, fixes, and download content from the exported in-memory structures defined here." }
        "Frontend/scripts/*" { "This script implements one piece of the frontend interaction model. It runs inside the browser after the SPA shell loads and updates the page in response to routing or user actions." }
        "Frontend/pages/*" { "This page fragment implements one route-sized screen inside the frontend shell. The router fetches it on demand, injects it into the main content container, and then lets the page-specific scripts bring it to life." }
        "Frontend/styles/*" { "This stylesheet implements the visual layer of the frontend prototype. It is not executable in the same way as the JavaScript files, but it still participates in the flow by defining how the rendered route shell and components appear." }
        "Infrastructure/session-orchestration/bootstrap_and_deploy.ps1" { "This script implements the full environment bring-up path for NeoTerritory. It loads configuration, resolves dependency availability, starts Docker and Minikube when needed, builds the runtime image, applies Kubernetes templates, and finally prepares the folder layout consumed by the executable." }
        "Infrastructure/runtime-layout/*" { "This script implements the filesystem contract expected by the microservice runtime. It creates the Input and Output subtree and can optionally seed placeholder files so later stages have a predictable directory layout." }
        "Infrastructure/session-orchestration/docker/Dockerfile" { "This file implements the container build recipe for NeoTerritory session execution. It defines the image composition that later gets built and deployed by the bootstrap scripts." }
        "Infrastructure/session-orchestration/k8s/templates/*" { "This manifest implements one deployment-side resource in the session orchestration story. The bootstrap script renders user-specific values into it and applies it so the runtime image becomes reachable inside the local cluster." }
        "Infrastructure/session-orchestration/installer.config.json" { "This configuration file implements the parameter source for the bootstrap script. It carries the image tag, Minikube profile, runtime root, and template paths that determine how the environment is assembled." }
        "Input/*" { "This file implements a sample input scenario rather than part of the runtime engine itself. Its code exists to be consumed by the microservice so the parser, detector, and transform pipeline can be exercised on a known pattern example." }
        "Microservice/main.cpp" { "This file implements the thinnest possible executable entrypoint. It accepts process control from the OS, forwards the arguments to the syntactic broken AST runner, and returns that runner's exit code unchanged." }
        "Microservice/Layer/*" { "This application-layer source file implements the runtime story that wraps the core parser modules. It is responsible for validating arguments, discovering files, invoking the analysis pipeline, and materializing all of the generated outputs." }
        "Microservice/Modules/Source/SyntacticBrokenAST/algorithm_pipeline.cpp" { "This file implements the ordered core pipeline of the C++ system. It measures and runs the parse, detect, hash-link, monolithic-generation, and validation stages, and then packages the resulting trees, tables, traces, and metrics into the artifact bundle returned to the application layer." }
        "Microservice/Modules/Source/SyntacticBrokenAST/source_reader.cpp" { "This file implements the source-ingestion step for the C++ pipeline. It opens each discovered file, reads the contents into SourceFileUnit records, and can also flatten the set into a monolithic source string for later evidence rendering." }
        "Microservice/Modules/Source/SyntacticBrokenAST/cli_arguments.cpp" { "This file implements the command-line contract for the executable. It supports the normal two-argument pattern pair, tolerates a compatibility form where both values arrive in one token, and rejects extra file-path arguments because the runtime now discovers inputs from the folder layout." }
        "Microservice/Modules/Source/SyntacticBrokenAST/codebase_output_writer.cpp" { "This file implements the final output-materialization step for generated code views. It sanitizes the target pattern name, ensures the output folders exist, and writes both .cpp and .html renderings of the base and target code artifacts." }
        "Microservice/Modules/Source/SyntacticBrokenAST/lexical_structure_hooks.cpp" { "This file implements the bridge between generic parsing and pattern-specific structural keywords. It resolves the keyword set for the selected source pattern, scans class declarations for hits, and records the crucial classes that later drive relevance filtering and symbol tracking." }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/core.cpp" { "This file implements the high-level parse-tree assembly loop. It creates the root and file nodes, parses each source file into the main tree, collects cross-file dependency information, and then derives the filtered shadow tree that keeps only relevant pattern evidence." }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/build.cpp" { "This file implements the line-by-line parse-tree construction mechanics. It tokenizes input lines, detects includes and classes, records line hash traces and factory invocation traces, opens and closes block scopes, and emits statements into the file-local parse tree." }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/*" { "This source file implements one internal part of the generic parse-tree engine. It contributes specialized behavior such as code generation, dependency handling, symbolization, or hash-link construction after the raw tree exists." }
        "Microservice/Modules/Source/SyntacticBrokenAST/*" { "This source file implements one of the generic middle-stage services in the C++ pipeline. It is executed after sources are loaded and before the final report and rendered outputs are written." }
        "Microservice/Modules/Header/SyntacticBrokenAST/*" { "This header implements the compile-time contract for the generic parse and analysis pipeline. It is included before runtime execution begins so the C++ sources can agree on the shared data structures and function signatures." }
        "Microservice/Modules/Source/Creational/Transform/*" { "This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views." }
        "Microservice/Modules/Source/Creational/*" { "This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions." }
        "Microservice/Modules/Header/Creational/*" { "This header implements the compile-time contract for the creational subsystem. It declares the detectors, transforms, and helper types that the runtime sources later define." }
        "Microservice/Modules/Source/Behavioural/*" { "This source file implements behavioural-pattern scaffolding or checks on top of the generic parse tree. It contributes one part of the behavioural broken-tree output by scanning for behavioural structure signals." }
        "Microservice/Modules/Header/Behavioural/*" { "This header implements the compile-time contract for the behavioural subsystem. It defines the interfaces and hook declarations used when the generic parser delegates behavioural structure decisions." }
        "Microservice/Test/Input/*" { "This file implements a regression corpus case for the microservice. Its code is not part of the executable itself; instead, it is analyzed so the pipeline can prove that specific pattern transitions or edge cases are handled correctly." }
        default { "This file participates in the NeoTerritory implementation as a focused artifact with a narrow local responsibility. Its behavior is best understood by reading it in the context of the module that loads or compiles it." }
    }

    $story = $baseStory + " " + $role + " " + $chronology

    $symbolSummary = Join-SummaryList $symbols 4
    if (-not [string]::IsNullOrWhiteSpace($symbolSummary))
    {
        $story += " The implementation surface is easiest to recognize through symbols such as " + $symbolSummary + "."
    }

    $dependencySummary = Join-SummaryList $dependencies 4
    if (-not [string]::IsNullOrWhiteSpace($dependencySummary))
    {
        $story += " In practice it collaborates directly with " + $dependencySummary + "."
    }

    return $story
}

function Get-PathActivitySteps([string]$relativePath, [string]$role)
{
    switch -Wildcard ($relativePath)
    {
        "setup.ps1" { return @("Check whether the shell is elevated", "Relaunch as Administrator when required", "Forward the effective parameters", "Invoke the infrastructure bootstrap script") }
        "setup.sh" { return @("Accept shell execution from the user", "Prepare or delegate repository setup", "Return control to the caller") }
        "test.sh" { return @("Start a quick validation run", "Invoke the repository test or check commands", "Surface the resulting status") }
        "CMakeLists.txt" { return @("Resolve compiler defaults", "Set the C++ standard and project metadata", "Collect microservice sources and headers", "Create the NeoTerritory executable target", "Attach include directories for the parser and pattern modules") }
        "Backend/server.js" { return @("Load environment and Node dependencies", "Ensure uploads and outputs directories exist", "Mount middleware and API routes", "Initialize the SQLite schema", "Start listening on the configured port") }
        "Backend/src/controllers/authController.js" { return @("Receive a register or login request", "Validate the payload fields", "Query the user record in SQLite", "Hash or compare credentials", "Log the auth event and send the response") }
        "Backend/src/controllers/transformController.js" { return @("Receive the authenticated upload request", "Validate the uploaded file and extension", "Sanitize and move the input file", "Create the output placeholder", "Persist the job row and log the operation", "Return job metadata to the client") }
        "Backend/src/routes/*" { return @("Receive an HTTP request for the route", "Run any configured middleware", "Forward control into the matching controller", "Serialize the controller result back to the client") }
        "Backend/src/middleware/jwtAuth.js" { return @("Inspect the Authorization header", "Check that a bearer token exists", "Verify the JWT with the configured secret", "Attach the decoded user or reject with 401") }
        "Backend/src/middleware/upload.js" { return @("Accept the multipart upload request", "Apply upload storage and filtering rules", "Expose the file object to downstream handlers") }
        "Backend/src/middleware/*" { return @("Receive the request inside the middleware layer", "Apply the cross-cutting rule owned by the file", "Forward or terminate the request") }
        "Backend/src/db/initDb.js" { return @("Open the configured SQLite database", "Create the users table if missing", "Create the jobs table if missing", "Create the logs table if missing", "Return control to backend startup") }
        "Backend/src/db/*" { return @("Enter the persistence helper", "Perform the file's database-focused responsibility", "Return data or side effects to the backend caller") }
        "Backend/src/services/*" { return @("Receive a service call from middleware or a controller", "Apply the reusable backend helper logic", "Return the service result") }
        "Backend/src/utils/*" { return @("Enter the utility helper", "Normalize or compute the needed value", "Return the result to the backend caller") }
        "Backend/package.json" { return @("Describe backend scripts", "Declare runtime dependencies", "Provide the startup contract to npm and Node tooling") }
        "Frontend/index.html" { return @("Load the shell document in the browser", "Apply shared styles", "Load route and page scripts", "Initialize the sidebar and router", "Render the selected route into the shell") }
        "Frontend/scripts/router.js" { return @("Observe the current hash route", "Resolve the page fragment path", "Fetch and inject the fragment", "Run page-ready hooks", "Animate and stabilize the new view") }
        "Frontend/scripts/sidebar.js" { return @("Bind sidebar, overlay, and theme listeners", "Apply the saved theme", "Handle navigation clicks", "Adjust mobile state on resize") }
        "Frontend/scripts/analysis.js" { return @("Wait for the user to start analysis", "Swap the page into progress mode", "Animate the staged progress bars", "Navigate to the results route") }
        "Frontend/scripts/api.js" { return @("Export the mock data structures", "Let page scripts read the exported data", "Render static prototype content without live API calls") }
        "Frontend/scripts/*" { return @("Load the page script in the browser", "Attach page-specific behavior", "Update the DOM as the user interacts with the prototype") }
        "Frontend/pages/*" { return @("Let the router request the page fragment", "Inject the fragment into the shell", "Run any matching page initialization logic", "Display the route-specific content to the user") }
        "Frontend/styles/*" { return @("Load the stylesheet", "Define shared tokens or component rules", "Apply the resulting visual treatment during render") }
        "Infrastructure/session-orchestration/bootstrap_and_deploy.ps1" { return @("Load installer configuration and resolve parameters", "Check or install required tools", "Start Docker and Minikube when needed", "Build the runtime image", "Apply Kubernetes templates", "Prepare the runtime folder layout") }
        "Infrastructure/runtime-layout/*" { return @("Resolve the target runtime directory", "Create Input and Output subdirectories", "Optionally create placeholder files", "Report the prepared layout") }
        "Infrastructure/session-orchestration/docker/Dockerfile" { return @("Start from the chosen base image", "Copy or install the runtime dependencies", "Build the NeoTerritory execution environment", "Publish the final image definition") }
        "Infrastructure/session-orchestration/k8s/templates/*" { return @("Receive rendered template values from bootstrap", "Create the Kubernetes resource manifest", "Apply the resource into the cluster", "Expose the session runtime") }
        "Infrastructure/session-orchestration/installer.config.json" { return @("Provide image and profile values", "Provide runtime-root and template paths", "Drive the bootstrap script with declarative configuration") }
        "Input/*" { return @("Enter the microservice as a sample source file", "Expose pattern-specific source structure", "Feed the parser and detector pipeline", "Contribute to generated outputs and evidence") }
        "Microservice/main.cpp" { return @("Receive process execution at main", "Forward argc and argv to the runner", "Return the runner exit code") }
        "Microservice/Layer/*" { return @("Validate CLI and runtime layout", "Discover the input files", "Read the source corpus", "Run the pipeline", "Write HTML, code, and JSON outputs", "Return the process exit code") }
        "Microservice/Modules/Source/SyntacticBrokenAST/algorithm_pipeline.cpp" { return @("Build the base and shadow parse graphs", "Run creational and behavioural detection", "Build symbol tables and hash links", "Generate the monolithic evidence view", "Validate graph consistency", "Return the artifact bundle and metrics") }
        "Microservice/Modules/Source/SyntacticBrokenAST/source_reader.cpp" { return @("Receive the discovered file paths", "Open each source file", "Read file content into SourceFileUnit records", "Optionally merge the units into a monolithic source view") }
        "Microservice/Modules/Source/SyntacticBrokenAST/cli_arguments.cpp" { return @("Inspect argc and argv", "Handle the compatibility one-token pattern form", "Reject unsupported extra arguments", "Return the normalized source and target patterns") }
        "Microservice/Modules/Source/SyntacticBrokenAST/codebase_output_writer.cpp" { return @("Sanitize the target pattern name", "Ensure generated output directories exist", "Compute base and target output paths", "Write generated C++ and HTML files", "Return the write status") }
        "Microservice/Modules/Source/SyntacticBrokenAST/lexical_structure_hooks.cpp" { return @("Resolve the structural keyword set for the source pattern", "Scan class declarations for keyword hits", "Register crucial classes", "Expose the crucial-class registry to later stages") }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/core.cpp" { return @("Create the root and per-file nodes", "Parse each file into the main tree", "Resolve include and symbol dependencies", "Compute the crucial class set", "Filter the shadow tree to relevant nodes", "Return the parse-tree bundle") }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/build.cpp" { return @("Split the file into lines and tokens", "Track includes, classes, and factory calls", "Record line hash traces", "Emit statements and blocks into the parse tree", "Flush the final file-local structure") }
        "Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/*" { return @("Enter the specialized parse-tree stage", "Traverse or transform the tree structures", "Publish the resulting parse-tree support artifact") }
        "Microservice/Modules/Source/SyntacticBrokenAST/*" { return @("Enter the generic syntactic pipeline service", "Apply the file's parsing, linking, rendering, or reporting responsibility", "Pass the result to the surrounding pipeline stage") }
        "Microservice/Modules/Header/SyntacticBrokenAST/*" { return @("Include the header during compilation", "Expose the shared types or function contracts", "Let implementation files compile against the declared interface") }
        "Microservice/Modules/Source/Creational/Transform/*" { return @("Receive source and pattern-route context", "Apply the creational transform or evidence logic", "Return transformed text or evidence sections", "Feed the generator and reporting layers") }
        "Microservice/Modules/Source/Creational/*" { return @("Traverse the generic parse tree", "Apply creational pattern rules", "Emit pattern candidates or transform decisions", "Return results to the pipeline") }
        "Microservice/Modules/Header/Creational/*" { return @("Include the header during compilation", "Expose creational detectors and transform contracts", "Allow source files to implement and consume the contract") }
        "Microservice/Modules/Source/Behavioural/*" { return @("Traverse the generic parse tree", "Apply behavioural scaffolding or structure checks", "Emit behavioural nodes into the broken tree", "Return the detector result") }
        "Microservice/Modules/Header/Behavioural/*" { return @("Include the header during compilation", "Expose behavioural detection and hook contracts", "Allow source files to implement and consume those contracts") }
        "Microservice/Test/Input/*" { return @("Enter the pipeline as a regression input", "Exercise one named transform or edge-case scenario", "Contribute to the resulting reports and generated outputs") }
        default { return @("Enter the file through its owning module", "Apply the local responsibility declared by the artifact", "Hand control or data to the next stage of the repository flow") }
    }
}

function New-MermaidActivity([string[]]$steps)
{
    $stepArray = @($steps)
    $lines = New-Object 'System.Collections.Generic.List[string]'
    $lines.Add('```mermaid')
    $lines.Add("flowchart TD")
    $lines.Add("    Start([Start])")

    for ($i = 0; $i -lt $stepArray.Count; ++$i)
    {
        $safeLabel = $stepArray[$i].Replace("[", "(")
        $safeLabel = $safeLabel.Replace("]", ")")
        $safeLabel = $safeLabel.Replace('"', "'")
        $lines.Add(("    N{0}[{1}]" -f $i, $safeLabel))
    }

    $lines.Add("    End([End])")

    if ($stepArray.Count -gt 0)
    {
        $lines.Add("    Start --> N0")
        for ($i = 0; $i -lt ($stepArray.Count - 1); ++$i)
        {
            $lines.Add(("    N{0} --> N{1}" -f $i, ($i + 1)))
        }
        $lines.Add(("    N{0} --> End" -f ($stepArray.Count - 1)))
    }
    else
    {
        $lines.Add("    Start --> End")
    }

    $lines.Add('```')
    return $lines
}

function New-FileDoc([string]$relativePath, [string]$content)
{
    $fileName = [System.IO.Path]::GetFileName($relativePath)
    $kind = Get-FileKind $relativePath
    $role = Get-Role $relativePath
    $chronology = Get-Chronology $relativePath
    $symbols = Get-KeySymbols $content $relativePath
    $dependencies = Get-Dependencies $content $relativePath
    $story = Get-ImplementationStory $relativePath $role $chronology $symbols $dependencies
    $activitySteps = Get-ActivityStepsFromCode $relativePath $content
    if ((@($activitySteps).Count) -eq 0)
    {
        $activitySteps = Get-PathActivitySteps $relativePath $role
    }
    $lineCount = ($content -split "\r?\n").Count

    $lines = New-Object 'System.Collections.Generic.List[string]'
    $lines.Add("# $fileName")
    $lines.Add("")
    $lines.Add("- Source: $relativePath")
    $lines.Add("- Kind: $kind")
    $lines.Add("- Lines: $lineCount")
    $lines.Add("- Role: $role")
    $lines.Add("- Chronology: $chronology")
    $lines.Add("")
    $lines.Add("## Notable Symbols")
    foreach ($line in (New-BulletLines $symbols "This artifact is primarily declarative or inline and does not expose many named symbols."))
    {
        $lines.Add($line)
    }
    $lines.Add("")
    $lines.Add("## Direct Dependencies")
    foreach ($line in (New-BulletLines $dependencies "No direct dependency list was extracted from the file text."))
    {
        $lines.Add($line)
    }
    $lines.Add("")
    $lines.Add("## Implementation Story")
    $lines.Add($story)
    $lines.Add("")
    $lines.Add("## Activity Diagram")
    foreach ($line in (New-MermaidActivity $activitySteps))
    {
        $lines.Add($line)
    }
    $lines.Add("")
    $lines.Add("## Documentation Note")
    $lines.Add("- This markdown file is part of the generated docs/Codebase mirror.")
    $lines.Add("- It was generated from the repository state on $generatedOn after reading the existing docs corpus and the current source tree.")

    return ($lines -join "`r`n") + "`r`n"
}

function Should-IncludeFile([System.IO.FileInfo]$file)
{
    if ($allowedNames -contains $file.Name)
    {
        return $true
    }

    return $allowedExtensions -contains $file.Extension.ToLowerInvariant()
}

if (Test-Path $generatedDocsRoot)
{
    Remove-Item -LiteralPath $generatedDocsRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $generatedDocsRoot -Force | Out-Null

$sourceFiles = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'

foreach ($rootFile in $rootFiles)
{
    $fullPath = Join-Path $repoRoot $rootFile
    if (Test-Path $fullPath)
    {
        $sourceFiles.Add((Get-Item $fullPath))
    }
}

foreach ($rootDir in $sourceRoots)
{
    $fullPath = Join-Path $repoRoot $rootDir
    if (-not (Test-Path $fullPath))
    {
        continue
    }

    Get-ChildItem -Path $fullPath -Recurse -File | Where-Object { Should-IncludeFile $_ } | ForEach-Object {
        $sourceFiles.Add($_)
    }
}

$files = @($sourceFiles | Sort-Object FullName -Unique)
$sourceFileMetadata = New-Object 'System.Collections.Generic.List[object]'

foreach ($file in $files)
{
    $relativePath = Get-RepoRelativePath $file.FullName
    $docRelativePath = Get-DocRelativePath $relativePath
    $role = Get-Role $relativePath
    $docPath = Join-Path $generatedDocsRoot $docRelativePath
    $docDir = Split-Path -Parent $docPath
    New-Item -ItemType Directory -Path $docDir -Force | Out-Null

    $content = Get-Content -Path $file.FullName -Raw
    $docContent = New-FileDoc $relativePath $content
    Set-Content -Path $docPath -Value $docContent -Encoding utf8

    $sourceFileMetadata.Add([PSCustomObject]@{
        SourceRelativePath = $relativePath
        RelativePath = $docRelativePath
        Directory = ([System.IO.Path]::GetDirectoryName($docRelativePath) -replace '\\','/')
        Name = [System.IO.Path]::GetFileName($relativePath)
        DocName = [System.IO.Path]::GetFileName($docRelativePath)
        Role = $role
        Group = Get-LogicalGroup $relativePath
    })
}

$sectionCounts = @{}
foreach ($file in $files)
{
    $relativePath = Get-RepoRelativePath $file.FullName
    $topLevel = if ($relativePath.Contains("/")) { $relativePath.Split("/")[0] } else { "RepositoryRoot" }
    if (-not $sectionCounts.ContainsKey($topLevel))
    {
        $sectionCounts[$topLevel] = 0
    }
    $sectionCounts[$topLevel] += 1
}

$allDirectories = New-Object 'System.Collections.Generic.HashSet[string]'
$null = $allDirectories.Add("")
foreach ($meta in $sourceFileMetadata)
{
    $dir = $meta.Directory
    if ([string]::IsNullOrWhiteSpace($dir))
    {
        $null = $allDirectories.Add("")
        continue
    }

    $current = $dir
    while (-not [string]::IsNullOrWhiteSpace($current))
    {
        $null = $allDirectories.Add($current)
        $parent = [System.IO.Path]::GetDirectoryName($current)
        if ([string]::IsNullOrWhiteSpace($parent))
        {
            $null = $allDirectories.Add("")
            break
        }
        $current = $parent.Replace('\', '/')
    }
}

$orderedDirectories = @(
    $allDirectories |
    ForEach-Object {
        [PSCustomObject]@{
            Path = $_
            Depth = if ([string]::IsNullOrWhiteSpace($_)) { 0 } else { $_.Split('/').Count }
        }
    } |
    Sort-Object -Property Depth, Path |
    Select-Object -ExpandProperty Path
)

foreach ($dir in $orderedDirectories)
{
    $immediateFiles = @($sourceFileMetadata | Where-Object { $_.Directory -eq $dir } | Sort-Object Name)

    $immediateChildDirs = @()
    foreach ($candidate in $orderedDirectories)
    {
        if ($candidate -eq $dir)
        {
            continue
        }
        if ([string]::IsNullOrWhiteSpace($candidate))
        {
            continue
        }

        $parent = [System.IO.Path]::GetDirectoryName($candidate)
        $normalizedParent = if ([string]::IsNullOrWhiteSpace($parent)) { "" } else { $parent.Replace('\', '/') }
        if ($normalizedParent -ne $dir)
        {
            continue
        }

        $childName = [System.IO.Path]::GetFileName($candidate)
        $childFiles = @($sourceFileMetadata | Where-Object { $_.RelativePath.StartsWith(($candidate + "/")) -or $_.Directory -eq $candidate })
        $group = Get-FolderGroup $candidate
        $summary = Get-FolderLogicSummary $candidate

        $immediateChildDirs += [PSCustomObject]@{
            Name = $childName
            RelativePath = $candidate
            Group = $group
            Summary = $summary
        }
    }

    $descendantFiles = if ([string]::IsNullOrWhiteSpace($dir))
    {
        $sourceFileMetadata.ToArray()
    }
    else
    {
        @($sourceFileMetadata | Where-Object { $_.Directory -eq $dir -or $_.RelativePath.StartsWith(($dir + "/")) })
    }

    $folderReadme = New-FolderReadme $dir $immediateChildDirs $immediateFiles (($descendantFiles | Measure-Object).Count)
    $readmePath = if ([string]::IsNullOrWhiteSpace($dir))
    {
        Join-Path $generatedDocsRoot "README.md"
    }
    else
    {
        Join-Path (Join-Path $generatedDocsRoot $dir) "README.md"
    }

    Set-Content -Path $readmePath -Value $folderReadme -Encoding utf8
}

Write-Host ("Generated {0} codebase mirror docs under {1}" -f ($files.Count), $generatedDocsRoot)
