#ifndef FACTORY_PATTERN_LOGIC_HPP
#define FACTORY_PATTERN_LOGIC_HPP

#include "creational_broken_tree.hpp"
#include "Logic/creational_pattern_mediator.hpp"
#include "parse_tree.hpp"

/**
 * @brief Analyze class/function/conditional blocks for factory-style creation:
 * return new T(...), return make_unique<T>/make_shared<T>(...), or return object indications
 * (e.g. return T(...), return var_of_T, return { ... } with known return type T),
 * where T is a known class.
 */
CreationalTreeNode build_factory_pattern_tree(const ParseTreeNode& parse_root);
const ICreationalPatternAlgorithm& factory_pattern_algorithm();

#endif // FACTORY_PATTERN_LOGIC_HPP
