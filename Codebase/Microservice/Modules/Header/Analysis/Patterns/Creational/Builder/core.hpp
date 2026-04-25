#pragma once

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode;

struct BuilderMethodStructureCheck
{
    std::string method_name;
    bool        returns_self_type    = false;
    bool        has_builder_assignment = false;
};

struct BuilderStructureCheckResult
{
    bool                                     is_builder = false;
    std::string                              class_name;
    std::vector<BuilderMethodStructureCheck> methods;
    std::vector<std::string>                 reasons;
};

BuilderStructureCheckResult check_builder_pattern_structure(const ParseTreeNode& class_node);

std::vector<std::string> assignments(const ParseTreeNode& method_node);
