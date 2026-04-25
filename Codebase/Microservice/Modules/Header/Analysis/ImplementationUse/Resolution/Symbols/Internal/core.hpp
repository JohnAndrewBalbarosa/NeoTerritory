#pragma once

#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode;
struct SymbolTableBuilder;

std::string trim(const std::string& text);

bool starts_with(const std::string& text, const std::string& prefix);

std::vector<std::string> split_words(const std::string& text);

std::string class_name_from_signature(const std::string& signature);

std::string function_name_from_signature(const std::string& signature);

std::vector<std::string> function_parameter_hint_from_signature(const std::string& signature);

std::size_t build_function_key(
    std::size_t                     parent_class_hash,
    const std::string&              function_name,
    const std::vector<std::string>& parameter_types);

bool is_main_function_name(const std::string& name);

bool is_class_block(const ParseTreeNode& node);

bool is_function_block(const ParseTreeNode& node);

bool is_candidate_usage_node(const ParseTreeNode& node);

std::string extract_return_candidate_name(const ParseTreeNode& function_node);

ParseTreeSymbolTables build_symbol_tables_with_builder(
    const ParseTreeNode&               root,
    SymbolTableBuilder&                builder,
    const ParseTreeSymbolBuildOptions& options);
