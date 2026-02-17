#ifndef CREATIONAL_BROKEN_TREE_HPP
#define CREATIONAL_BROKEN_TREE_HPP

#include "parse_tree.hpp"

#include <string>
#include <vector>

struct CreationalTreeNode
{
    std::string kind;
    std::string label;
    std::vector<CreationalTreeNode> children;
};

/**
 * @brief Build a simplified creational traversal tree from the base C++ parse tree.
 * Pattern focus: Class -> Function -> Control Block (if/switch/else-if) -> Return target.
 */
CreationalTreeNode build_creational_broken_tree(const ParseTreeNode& root);
ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode& root);
std::string creational_tree_to_html(const CreationalTreeNode& root);

/**
 * @brief Print the creational traversal tree as text.
 */
std::string creational_tree_to_text(const CreationalTreeNode& root);

#endif // CREATIONAL_BROKEN_TREE_HPP
