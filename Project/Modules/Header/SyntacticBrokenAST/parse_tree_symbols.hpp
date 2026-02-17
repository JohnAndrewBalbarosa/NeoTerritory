#ifndef PARSE_TREE_SYMBOLS_HPP
#define PARSE_TREE_SYMBOLS_HPP

#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct ParseSymbol
{
    std::string name;
    std::string signature;
    size_t hash_value;
};

/**
 * @brief Rebuild global class/function symbol tables from a parse tree.
 */
void rebuild_parse_tree_symbol_tables(const ParseTreeNode& root);

/**
 * @brief Traverseable global class symbol table.
 */
const std::vector<ParseSymbol>& getClassSymbolTable();

/**
 * @brief Traverseable global function symbol table.
 */
const std::vector<ParseSymbol>& getFunctionSymbolTable();

/**
 * @brief Lookup class symbol by exact name.
 */
const ParseSymbol* getClassByName(const std::string& name);

/**
 * @brief Lookup function symbol by exact name.
 */
const ParseSymbol* getFunctionByName(const std::string& name);

/**
 * @brief Check whether `return [new] Name(...)` references a known class symbol.
 */
bool returnTargetsKnownClass(const std::string& return_expression);

#endif // PARSE_TREE_SYMBOLS_HPP
