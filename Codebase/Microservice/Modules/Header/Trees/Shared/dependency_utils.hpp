#pragma once

#include "Trees/Actual/parse_tree.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct DependencySymbolNode
{
    std::string          name;
    std::size_t          symbol_hash = 0;
    const ParseTreeNode* node        = nullptr;
};

std::vector<DependencySymbolNode> collect_dependency_class_nodes(const ParseTreeNode& root);

std::vector<DependencySymbolNode> collect_dependency_function_nodes(const ParseTreeNode& root);
