#ifndef BEHAVIOURAL_SYMBOL_TEST_HPP
#define BEHAVIOURAL_SYMBOL_TEST_HPP

#include "parse_tree.hpp"

#include <string>

/**
 * @brief Build a test tree where root has function-symbol siblings verified via hash lookup.
 */
ParseTreeNode build_behavioural_symbol_test_tree(const ParseTreeNode& parse_root);

/**
 * @brief Render a test tree to text.
 */
std::string behavioural_symbol_test_to_text(const ParseTreeNode& root);

#endif // BEHAVIOURAL_SYMBOL_TEST_HPP
