#include "OutputGeneration/Contracts/algorithm_pipeline.hpp"

PipelineReport run_normalize_and_rewrite_pipeline(
    const std::vector<std::string>&,
    const std::string&)
{
    return {};
}

std::string pipeline_report_to_json(const PipelineReport&)
{
    return "{}";
}
