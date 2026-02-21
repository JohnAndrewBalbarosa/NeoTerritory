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
    size_t name_hash;
    size_t hash_value;
    size_t contextual_hash;
    size_t definition_node_index;
};

struct ParseSymbolUsage
{
    std::string name;
    std::string type_string;
    std::string node_kind;
    std::string node_value;
    size_t node_index;
    size_t node_contextual_hash;
    size_t class_name_hash;
    size_t hash_value;
    bool refactor_candidate;
    bool hash_collision;
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
 * @brief Traverseable class usage symbol table.
 */
const std::vector<ParseSymbolUsage>& getClassUsageTable();

/**
 * @brief Lookup class symbol by exact name.
 */
const ParseSymbol* getClassByName(const std::string& name);
const ParseSymbol* getClassByHash(size_t hash_value);

/**
 * @brief Lookup function symbol by exact name.
 */
const ParseSymbol* getFunctionByName(const std::string& name);

/**
 * @brief Get all class usages for a class name.
 */
std::vector<ParseSymbolUsage> getClassUsagesByName(const std::string& name);

/**
 * @brief Check whether `return [new] Name(...)` references a known class symbol.
 */
bool returnTargetsKnownClass(const std::string& return_expression);

#endif // PARSE_TREE_SYMBOLS_HPP
