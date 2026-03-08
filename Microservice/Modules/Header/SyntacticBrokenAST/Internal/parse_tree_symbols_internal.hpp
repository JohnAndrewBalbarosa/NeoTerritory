#ifndef PARSE_TREE_SYMBOLS_INTERNAL_HPP
#define PARSE_TREE_SYMBOLS_INTERNAL_HPP

#include "parse_tree_symbols.hpp"

#include <string>
#include <vector>

namespace parse_tree_symbols_internal
{
std::string trim(const std::string& input);
bool starts_with(const std::string& text, const std::string& prefix);
std::vector<std::string> split_words(const std::string& text);

std::string class_name_from_signature(const std::string& signature);
std::string function_name_from_signature(const std::string& signature);
std::string function_parameter_hint_from_signature(const std::string& signature);
std::string build_function_key(
    const std::string& file_path,
    const std::string& owner_scope,
    const std::string& function_name,
    const std::string& signature);

bool is_main_function_name(const std::string& name);
bool is_class_block(const ParseTreeNode& node);
bool is_function_block(const ParseTreeNode& node);
bool is_candidate_usage_node(const ParseTreeNode& node);
std::string extract_return_candidate_name(const std::string& return_expression);

ParseTreeSymbolTables build_symbol_tables_with_builder(
    const ParseTreeNode& root,
    const ParseTreeSymbolBuildOptions& options);
} // namespace parse_tree_symbols_internal

#endif // PARSE_TREE_SYMBOLS_INTERNAL_HPP
