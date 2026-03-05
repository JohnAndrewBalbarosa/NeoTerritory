#ifndef PARSE_TREE_CODE_GENERATOR_HPP
#define PARSE_TREE_CODE_GENERATOR_HPP

#include "parse_tree.hpp"

#include <string>
#include <vector>

struct TransformDecision
{
    std::string class_name;
    bool transform_applied = false;
    std::vector<std::string> transform_reason;
};

std::string generate_base_code_from_source(const std::string& source);
std::string generate_target_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

const std::vector<TransformDecision>& get_last_transform_decisions();

#endif // PARSE_TREE_CODE_GENERATOR_HPP
