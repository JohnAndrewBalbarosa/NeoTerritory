#pragma once

#include "Trees/Actual/parse_tree.hpp"

#include <string>
#include <vector>

struct TransformDecision
{
    std::string source_class_name;
    std::string target_class_name;
    std::string transform_kind;
    std::string reason;
    bool        applied = false;
};

std::string generate_base_code_from_source(
    const ParseTreeNode& root,
    const std::string&   target_class_name);

std::string generate_target_code_from_source(
    const ParseTreeNode& root,
    const std::string&   target_class_name);

std::vector<TransformDecision> get_last_transform_decisions();
