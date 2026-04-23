#ifndef CREATIONAL_TRANSFORM_PIPELINE_HPP
#define CREATIONAL_TRANSFORM_PIPELINE_HPP

#include "parse_tree_code_generator.hpp"

#include <string>
#include <vector>

struct CreationalTransformResult
{
    std::string transformed_source;
    std::vector<TransformDecision> decisions;
};

CreationalTransformResult run_creational_transform_pipeline(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

std::string render_creational_evidence_view(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view,
    const std::string& source_pattern = "",
    const std::string& target_pattern = "");

#endif // CREATIONAL_TRANSFORM_PIPELINE_HPP
