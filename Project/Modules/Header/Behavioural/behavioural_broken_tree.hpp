#ifndef BEHAVIOURAL_BROKEN_TREE_HPP
#define BEHAVIOURAL_BROKEN_TREE_HPP

#include "parse_tree.hpp"

#include <string>

/**
 * @brief Build behavioural broken tree: root node with function-symbol siblings.
 */
ParseTreeNode build_behavioural_broken_tree(const ParseTreeNode& parse_root);
std::string behavioural_broken_tree_to_html(const ParseTreeNode& root);

#endif // BEHAVIOURAL_BROKEN_TREE_HPP
