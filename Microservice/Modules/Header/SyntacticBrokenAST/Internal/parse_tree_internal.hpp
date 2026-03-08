#ifndef PARSE_TREE_INTERNAL_HPP
#define PARSE_TREE_INTERNAL_HPP

#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace parse_tree_internal
{
struct RegisteredClassSymbol
{
    std::string class_name;
    std::string file_path;
    size_t class_name_hash = 0;
    size_t contextual_hash = 0;
};

using ClassHashRegistry = std::unordered_map<size_t, std::vector<RegisteredClassSymbol>>;

inline constexpr const char* k_file_class_bucket_kind = "ClassDeclarations";
inline constexpr const char* k_file_global_function_bucket_kind = "GlobalFunctionDeclarations";

size_t hash_combine_token(size_t seed, const std::string& token);
std::string make_fnv1a64_hash_id(const std::string& token);
size_t derive_child_context_hash(
    size_t parent_hash,
    const std::string& kind,
    const std::string& value,
    size_t sibling_index);
size_t hash_class_name_with_file(const std::string& file_path, const std::string& class_name);
void rehash_subtree(ParseTreeNode& node, size_t parent_hash, size_t sibling_index);
void add_unique_hash(std::vector<size_t>& hashes, size_t hash_value);
std::string usage_hash_suffix(const std::vector<size_t>& active_usage_hashes);
std::string usage_hash_list(const std::vector<size_t>& usage_hashes);

std::vector<std::string> tokenize_text(const std::string& source);
std::string join_tokens(const std::vector<std::string>& tokens, size_t start, size_t end);
std::vector<std::string> split_lines(const std::string& source);
std::string file_basename(const std::string& path);
std::string include_target_from_line(const std::string& line);

std::string detect_statement_kind(const std::vector<std::string>& statement_tokens);
bool is_class_or_struct_signature(const std::string& signature);
bool is_function_signature(const std::string& signature);
bool is_class_declaration_node(const ParseTreeNode& node);
bool is_global_function_declaration_node(const ParseTreeNode& node);

ParseTreeNode* node_at_path(ParseTreeNode& root, const std::vector<size_t>& path);
const ParseTreeNode* node_at_path(const ParseTreeNode& root, const std::vector<size_t>& path);
size_t append_node_at_path(ParseTreeNode& root, const std::vector<size_t>& path, ParseTreeNode node);

void register_classes_in_line(
    const std::string& file_path,
    const std::vector<std::string>& line_tokens,
    const ParseTreeBuildContext& context,
    StructuralAnalysisState& structural_state,
    ClassHashRegistry& class_hash_registry);

bool token_hits_registered_class(
    const std::string& token,
    const ClassHashRegistry& class_hash_registry,
    size_t& out_class_hash,
    bool& out_collision,
    size_t* out_matched_context_hash);

void collect_line_hash_trace(
    const std::string& file_path,
    size_t line_number,
    const std::vector<std::string>& line_tokens,
    size_t hit_token_index,
    size_t class_hash,
    size_t matched_class_context_hash,
    bool hash_collision,
    size_t scope_hash,
    std::vector<LineHashTrace>& line_hash_traces);

void bucketize_file_node_for_traversal(ParseTreeNode& file_node);

bool line_contains_any_tracked_token(
    const std::string& line_value,
    const std::unordered_set<std::string>& tracked_class_names,
    const std::unordered_set<std::string>& tracked_function_names);

bool append_shadow_subtree_if_relevant(
    const ParseTreeNode& source,
    const std::unordered_set<std::string>& tracked_class_names,
    const std::unordered_set<std::string>& tracked_function_names,
    ParseTreeNode& out_shadow_node);

void parse_file_content_into_node(
    const SourceFileUnit& file,
    ParseTreeNode& file_node,
    const ParseTreeBuildContext& context,
    StructuralAnalysisState& structural_state,
    std::vector<LineHashTrace>& line_hash_traces,
    std::vector<FactoryInvocationTrace>& factory_invocation_traces,
    ClassHashRegistry& class_hash_registry);

void collect_class_definitions_by_file(
    const ParseTreeNode& node,
    const std::string& current_file,
    std::unordered_map<std::string, std::string>& class_def_file);

void collect_symbol_dependencies_for_file(
    const ParseTreeNode& node,
    const std::string& current_file,
    const std::unordered_map<std::string, std::string>& class_def_file,
    std::unordered_set<std::string>& emitted,
    std::vector<ParseTreeNode>& out_dependencies);

void resolve_include_dependencies(
    ParseTreeNode& node,
    const std::unordered_map<std::string, std::string>& basename_to_path);
} // namespace parse_tree_internal

#endif // PARSE_TREE_INTERNAL_HPP
