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
    PipelineReport&            report,
    const CodebaseOutputPaths& paths);

void write_evidence_files_only(
    PipelineReport&            report,
    const CodebaseOutputPaths& paths);

std::string render_pipeline_report_json(const PipelineReport& report);
