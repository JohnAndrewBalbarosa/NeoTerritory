#pragma once

#include "Trees/Actual/parse_tree.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

struct RegisteredClassSymbol
{
    std::string name;
    std::size_t class_hash = 0;
    std::string file_name;
};

std::size_t hash_combine_token(std::size_t seed, const std::string& token);

std::size_t make_fnv1a64_hash_id(const std::string& text);

std::size_t derive_child_context_hash(std::size_t parent_hash, const std::string& child_token);

std::size_t hash_class_name_with_file(const std::string& class_name, const std::string& file_name);

void rehash_subtree(ParseTreeNode& subtree_root, std::size_t parent_hash);

void add_unique_hash(std::vector<std::size_t>& list, std::size_t value);

std::size_t usage_hash_suffix(std::size_t parent_hash, const std::string& usage_token);

std::vector<std::size_t> usage_hash_list(const ParseTreeNode& usage_node);

std::vector<std::string> tokenize_text(const std::string& text);

std::string join_tokens(const std::vector<std::string>& tokens, const std::string& separator);

std::vector<std::string> split_lines(const std::string& text);

std::string file_basename(const std::string& path);

std::string include_target_from_line(const std::string& line);

std::string detect_statement_kind(const std::string& line);

bool is_class_or_struct_signature(const std::string& line);

bool is_function_signature(const std::string& line);

bool is_class_declaration_node(const ParseTreeNode& node);

bool is_global_function_declaration_node(const ParseTreeNode& node);
