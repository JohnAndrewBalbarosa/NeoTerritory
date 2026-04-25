#pragma once

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode;

std::string lower(const std::string& text);

std::string trim(const std::string& text);

std::vector<std::string> split_words(const std::string& text);

bool starts_with(const std::string& text, const std::string& prefix);

std::size_t find_matching_brace(const std::string& text, std::size_t open_brace_position);

bool is_class_block(const ParseTreeNode& node);

bool is_function_block(const ParseTreeNode& node);

std::string class_name_from_signature(const std::string& signature);

std::string function_name_from_signature(const std::string& signature);

void inject_singleton_accessor(ParseTreeNode& class_node, const std::string& accessor_name);

void rewrite_class_instantiations_to_singleton_references(
    ParseTreeNode&     root,
    const std::string& class_name);

std::vector<std::string> extract_crucial_class_names(const ParseTreeNode& root);

void ensure_decision(ParseTreeNode& node, const std::string& decision_label);

void add_reason_if_missing(ParseTreeNode& node, const std::string& reason);
