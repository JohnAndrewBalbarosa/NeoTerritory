#ifndef CREATIONAL_SYMBOL_TEST_HPP
#define CREATIONAL_SYMBOL_TEST_HPP

#include "parse_tree.hpp"

#include <string>

/**
 * @brief Build a test tree where root has class-symbol siblings verified via hash lookup.
 */
ParseTreeNode build_creational_symbol_test_tree(const ParseTreeNode& parse_root);

/**
 * @brief Render a test tree to text.
 */
std::string creational_symbol_test_to_text(const ParseTreeNode& root);

#endif // CREATIONAL_SYMBOL_TEST_HPP
