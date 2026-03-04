#ifndef PARSE_TREE_CODE_GENERATOR_INTERNAL_HPP
#define PARSE_TREE_CODE_GENERATOR_INTERNAL_HPP

#include <string>

std::string transform_using_registered_rule_internal(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

std::string build_monolithic_evidence_view_internal(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view);

#endif // PARSE_TREE_CODE_GENERATOR_INTERNAL_HPP
