#ifndef PARSE_TREE_DEPENDENCY_UTILS_HPP
#define PARSE_TREE_DEPENDENCY_UTILS_HPP

#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct DependencySymbolNode
{
    std::string name;
    std::string signature;
    size_t hash_value;
};

std::vector<DependencySymbolNode> collect_dependency_class_nodes(const ParseTreeNode& root);
std::vector<DependencySymbolNode> collect_dependency_function_nodes(const ParseTreeNode& root);

#endif // PARSE_TREE_DEPENDENCY_UTILS_HPP
