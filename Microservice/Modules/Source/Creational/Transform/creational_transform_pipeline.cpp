#include "Transform/creational_transform_pipeline.hpp"

#include "Transform/creational_code_generator_internal.hpp"

CreationalTransformResult run_creational_transform_pipeline(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    CreationalTransformResult result;
    result.transformed_source = creational_codegen_internal::transform_using_registered_rule(
        source,
        source_pattern,
        target_pattern);
    result.decisions = creational_codegen_internal::g_last_transform_decisions;
    return result;
}

std::string render_creational_evidence_view(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view)
{
    return creational_codegen_internal::build_monolithic_evidence_view(source_code, target_code, target_view);
}
