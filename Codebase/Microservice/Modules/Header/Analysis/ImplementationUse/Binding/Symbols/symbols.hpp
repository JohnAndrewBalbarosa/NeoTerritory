#pragma once

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

struct ParseTreeNode;

struct ParseSymbol
{
    const ParseTreeNode* actual_head  = nullptr;
    const ParseTreeNode* virtual_head = nullptr;
    // Hashes of base classes resolved against the file-local class
    // registry. Bases that the registry doesn't know about (external
    // headers, std lib, templated bases whose head is not a registered
    // class) are skipped here — they live as name-only entries on the
    // ParseTreeNode::bases vector for callers that need them.
    std::vector<std::size_t> parent_hashes;
};

struct ParseSymbolUsage
{
    const ParseTreeNode* usage_node          = nullptr;
    std::size_t          containing_function = 0;
};

struct ParseTreeSymbolBuildOptions
{
    bool collect_usages = true;
};

struct ParseTreeSymbolTables
{
    std::unordered_map<std::size_t, ParseSymbol>                   classes;
    std::unordered_map<std::size_t, ParseSymbol>                   functions;
    std::unordered_map<std::size_t, std::vector<ParseSymbolUsage>> class_usages;
    // Reverse inheritance index: parent_class_hash → child class hashes
    // that declare it as a base. Lets the matcher resolve "who inherits
    // from X?" in O(1) without walking the class table.
    std::unordered_map<std::size_t, std::vector<std::size_t>>      parents_to_children;
};

ParseTreeSymbolTables build_parse_tree_symbol_tables(
    const ParseTreeNode&               root,
    const ParseTreeSymbolBuildOptions& options);

const std::unordered_map<std::size_t, ParseSymbol>& class_symbol_table(
    const ParseTreeSymbolTables& tables);

const std::unordered_map<std::size_t, ParseSymbol>& function_symbol_table(
    const ParseTreeSymbolTables& tables);

const std::unordered_map<std::size_t, std::vector<ParseSymbolUsage>>& class_usage_table(
    const ParseTreeSymbolTables& tables);

const ParseSymbol* find_class_by_name(
    const ParseTreeSymbolTables& tables,
    const std::string&           name,
    const std::string&           file_name);

const ParseSymbol* find_class_by_hash(
    const ParseTreeSymbolTables& tables,
    std::size_t                  class_hash);

const ParseSymbol* find_function_by_name(
    const ParseTreeSymbolTables&    tables,
    const std::string&              name,
    std::size_t                     parent_class_hash,
    const std::vector<std::string>& parameter_types);

const ParseSymbol* find_function_by_key(
    const ParseTreeSymbolTables& tables,
    std::size_t                  function_hash);

std::vector<const ParseSymbol*> find_functions_by_name(
    const ParseTreeSymbolTables& tables,
    const std::string&           name);

std::vector<ParseSymbolUsage> find_class_usages_by_name(
    const ParseTreeSymbolTables& tables,
    const std::string&           name,
    const std::string&           file_name);

bool return_targets_known_class(
    const ParseTreeSymbolTables& tables,
    std::size_t                  function_hash);
