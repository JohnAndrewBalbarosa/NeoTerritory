#include "parse_tree_code_generator.hpp"

#include "Transform/creational_transform_pipeline.hpp"

namespace
{
std::vector<TransformDecision> g_last_transform_decisions;
}

const std::vector<TransformDecision>& get_last_transform_decisions()
{
    return g_last_transform_decisions;
}

std::string generate_base_code_from_source(const std::string& source)
{
    return generate_base_code_from_source(source, "", "");
}

std::string generate_base_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    return render_creational_evidence_view(source, "", false, source_pattern, target_pattern);
}

std::string generate_target_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    const CreationalTransformResult result = run_creational_transform_pipeline(
        source,
        source_pattern,
        target_pattern);

    g_last_transform_decisions = result.decisions;
    return render_creational_evidence_view(
        source,
        result.transformed_source,
        true,
        source_pattern,
        target_pattern);
}
