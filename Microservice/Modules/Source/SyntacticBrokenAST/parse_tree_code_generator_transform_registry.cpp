#include "Internal/parse_tree_code_generator_internal.hpp"

#include <string>
#include <vector>

namespace parse_tree_codegen_internal
{
using TransformFn = std::string (*)(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

struct TransformRule
{
    const char* source_pattern;
    const char* target_pattern;
    TransformFn transform;
};

bool pattern_matches(const std::string& normalized_input, const char* expected_pattern)
{
    const std::string expected = lower(expected_pattern == nullptr ? "" : expected_pattern);
    return expected == "*" || expected == normalized_input;
}

const std::vector<TransformRule>& transform_rules()
{
    static const std::vector<TransformRule> rules = {
        {"singleton", "builder", &transform_singleton_to_builder},
        {"*", "singleton", &transform_to_singleton_by_class_references},
    };
    return rules;
}

std::string transform_using_registered_rule(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    g_last_transform_decisions.clear();

    const std::string normalized_source = lower(source_pattern);
    const std::string normalized_target = lower(target_pattern);

    for (const TransformRule& rule : transform_rules())
    {
        if (!pattern_matches(normalized_source, rule.source_pattern))
        {
            continue;
        }
        if (!pattern_matches(normalized_target, rule.target_pattern))
        {
            continue;
        }
        return rule.transform(source, source_pattern, target_pattern);
    }

    return source;
}
} // namespace parse_tree_codegen_internal
