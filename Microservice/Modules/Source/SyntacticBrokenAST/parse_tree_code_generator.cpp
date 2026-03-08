#include "parse_tree_code_generator.hpp"

#include "Internal/parse_tree_code_generator_internal.hpp"

const std::vector<TransformDecision>& get_last_transform_decisions()
{
    return parse_tree_codegen_internal::g_last_transform_decisions;
}

std::string generate_base_code_from_source(const std::string& source)
{
    return parse_tree_codegen_internal::build_monolithic_evidence_view(source, "", false);
}

std::string generate_target_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    const std::string transformed = parse_tree_codegen_internal::transform_using_registered_rule(
        source,
        source_pattern,
        target_pattern);

    return parse_tree_codegen_internal::build_monolithic_evidence_view(source, transformed, true);
}
