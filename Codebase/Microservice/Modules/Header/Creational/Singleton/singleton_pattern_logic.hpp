#ifndef SINGLETON_PATTERN_LOGIC_HPP
#define SINGLETON_PATTERN_LOGIC_HPP

#include "creational_broken_tree.hpp"
#include "Logic/creational_pattern_mediator.hpp"
#include "parse_tree.hpp"

/**
 * @brief Analyze classes for singleton-style function pattern:
 * static ClassName identifier; return identifier;
 */
CreationalTreeNode build_singleton_pattern_tree(const ParseTreeNode& parse_root);
const ICreationalPatternAlgorithm& singleton_pattern_algorithm();

#endif // SINGLETON_PATTERN_LOGIC_HPP
