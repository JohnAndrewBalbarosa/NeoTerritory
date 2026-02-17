#ifndef BUILDER_PATTERN_LOGIC_HPP
#define BUILDER_PATTERN_LOGIC_HPP

#include "creational_broken_tree.hpp"
#include "parse_tree.hpp"

/**
 * @brief Analyze classes for builder-style setup:
 * multiple methods containing assignments and member assignments (obj->attribute = ...).
 */
CreationalTreeNode build_builder_pattern_tree(const ParseTreeNode& parse_root);

#endif // BUILDER_PATTERN_LOGIC_HPP
