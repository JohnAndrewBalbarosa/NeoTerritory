#pragma once

#include "OutputGeneration/Contracts/algorithm_pipeline.hpp"

#include <string>

struct CodebaseOutputPaths
{
    std::string root;
    std::string html_directory;
    std::string json_report_path;
    std::string evidence_directory;
};

void write_codebase_outputs(
    const PipelineReport&      report,
    const CodebaseOutputPaths& paths);
