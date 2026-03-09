#ifndef PARSE_TREE_SYMBOLS_HPP
#define PARSE_TREE_SYMBOLS_HPP

#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <unordered_set>
#include <vector>

struct ParseSymbol
{
    std::string name;
    std::string signature;
    std::string file_path;
    std::string owner_scope;
    std::string function_key;
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

struct ParseTreeSymbolBuildOptions
{
    std::unordered_set<std::string> refactor_candidate_class_names;
};

struct ParseTreeSymbolTables
{
    std::vector<ParseSymbol> class_symbols;
    std::vector<ParseSymbol> function_symbols;
    std::vector<ParseSymbolUsage> class_usages;
};

/**
 * @brief Build class/function symbol tables from a parse tree.
 */
ParseTreeSymbolTables build_parse_tree_symbol_tables(
    const ParseTreeNode& root,
    const ParseTreeSymbolBuildOptions& options = ParseTreeSymbolBuildOptions{});

/**
 * @brief Traverseable class symbol table.
 */
const std::vector<ParseSymbol>& class_symbol_table(const ParseTreeSymbolTables& tables);

/**
 * @brief Traverseable function symbol table.
 */
const std::vector<ParseSymbol>& function_symbol_table(const ParseTreeSymbolTables& tables);

/**
 * @brief Traverseable class usage symbol table.
 */
const std::vector<ParseSymbolUsage>& class_usage_table(const ParseTreeSymbolTables& tables);

/**
 * @brief Lookup class symbol by exact name.
 */
const ParseSymbol* find_class_by_name(const ParseTreeSymbolTables& tables, const std::string& name);
const ParseSymbol* find_class_by_hash(const ParseTreeSymbolTables& tables, size_t hash_value);

/**
 * @brief Lookup function symbol by exact name.
 */
const ParseSymbol* find_function_by_name(const ParseTreeSymbolTables& tables, const std::string& name);
const ParseSymbol* find_function_by_key(const ParseTreeSymbolTables& tables, const std::string& function_key);
std::vector<const ParseSymbol*> find_functions_by_name(const ParseTreeSymbolTables& tables, const std::string& name);

/**
 * @brief Get all class usages for a class name.
 */
std::vector<ParseSymbolUsage> find_class_usages_by_name(const ParseTreeSymbolTables& tables, const std::string& name);

/**
 * @brief Check whether `return [new] Name(...)` references a known class symbol.
 */
bool return_targets_known_class(const ParseTreeSymbolTables& tables, const std::string& return_expression);

#endif // PARSE_TREE_SYMBOLS_HPP
