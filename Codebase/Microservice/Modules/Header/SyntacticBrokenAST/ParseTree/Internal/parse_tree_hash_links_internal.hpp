#ifndef PARSE_TREE_HASH_LINKS_INTERNAL_HPP
#define PARSE_TREE_HASH_LINKS_INTERNAL_HPP

#include "parse_tree_hash_links.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

namespace parse_tree_hash_links_internal
{
struct CollectedNode
{
    NodeRef ref;
    bool is_class_declaration = false;
    std::string class_name;
    size_t class_name_hash = 0;
};

struct SideIndexes
{
    std::vector<CollectedNode> nodes;
    std::unordered_map<std::string, std::unordered_map<size_t, std::vector<size_t>>> contextual_by_file;
    std::unordered_map<std::string, std::unordered_map<size_t, std::vector<size_t>>> usage_by_file;
    std::unordered_map<size_t, std::vector<size_t>> class_decl_by_name_hash;
    std::unordered_map<std::string, std::vector<size_t>> class_decl_by_exact_name;
};

struct ResolutionResult
{
    std::string status;
    std::vector<size_t> node_indices;
};

std::string trim(const std::string& input);
std::string file_basename(const std::string& path);
std::vector<std::string> split_words(const std::string& text);
std::string class_name_from_signature(const std::string& signature);
bool is_class_declaration_node(const ParseTreeNode& node);
std::string chain_entry(const std::string& kind, const std::string& value);
std::string parent_tail_key(const NodeRef& ref, size_t depth);
int compare_index_paths(const std::vector<size_t>& lhs, const std::vector<size_t>& rhs);
void dedupe_keep_order(std::vector<size_t>& values);
std::string combine_status(const std::string& left, const std::string& right);

void collect_side_nodes(
    const ParseTreeNode& root,
    const std::string& tree_side,
    SideIndexes& out);

ResolutionResult resolve_candidates(
    const SideIndexes& side,
    std::vector<size_t> candidates,
    const std::string& expected_class_name,
    const std::string& expected_file_path,
    size_t preferred_contextual_hash);

std::vector<NodeRef> build_node_refs(const SideIndexes& side, const std::vector<size_t>& node_indices);
std::vector<size_t> lookup_class_candidates(const SideIndexes& side, size_t class_name_hash);
std::vector<size_t> lookup_usage_candidates(
    const SideIndexes& side,
    const std::string& file_path,
    size_t outgoing_hash,
    const std::vector<size_t>& hash_chain);
} // namespace parse_tree_hash_links_internal

#endif // PARSE_TREE_HASH_LINKS_INTERNAL_HPP
