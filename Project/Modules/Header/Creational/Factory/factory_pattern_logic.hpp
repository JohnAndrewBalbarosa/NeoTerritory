#ifndef FACTORY_PATTERN_LOGIC_HPP
#define FACTORY_PATTERN_LOGIC_HPP

#include "creational_broken_tree.hpp"
#include "parse_tree.hpp"

/**
 * @brief Analyze class/function/conditional blocks for factory-style creation:
 * return new T(...) or return make_unique<T>/make_shared<T>(...) where T is a known class.
 */
CreationalTreeNode build_factory_pattern_tree(const ParseTreeNode& parse_root);

#endif // FACTORY_PATTERN_LOGIC_HPP
