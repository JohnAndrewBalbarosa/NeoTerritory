#pragma once

#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "HashingMechanism/HashLinks/hash_links.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

struct ParseTreeNode;

struct CollectedNode
{
    std::size_t          hash = 0;
    const ParseTreeNode* node = nullptr;
    std::string          file_name;
    NodeAncestry         ancestry;
};

struct SideIndexes
{
    std::unordered_map<std::size_t, std::vector<CollectedNode>> by_class_hash;
    std::unordered_map<std::size_t, std::vector<CollectedNode>> by_function_hash;
};

struct ResolutionResult
{
    bool                 resolved = false;
    NodeRef              declaration;
    std::vector<NodeRef> candidates;
    std::string          reason;
};

std::string trim(const std::string& text);

std::string file_basename(const std::string& path);

std::vector<std::string> split_words(const std::string& text);

std::string class_name_from_signature(const std::string& signature);

bool is_class_declaration_node(const ParseTreeNode& node);

std::size_t chain_entry(const NodeAncestry& ancestry, std::size_t depth);

std::size_t parent_tail_key(const NodeAncestry& ancestry);

int compare_index_paths(const NodeAncestry& left, const NodeAncestry& right);

std::vector<CollectedNode> dedupe_keep_order(const std::vector<CollectedNode>& nodes);

bool combine_status(bool current, bool next);

std::vector<CollectedNode> collect_side_nodes(
    const ParseTreeNode& root,
    const std::string&   file_name);

ResolutionResult resolve_candidates(
    const std::vector<CollectedNode>& candidates,
    const NodeAncestry&               usage_ancestry);

std::vector<NodeRef> build_node_refs(const std::vector<CollectedNode>& nodes);

std::vector<CollectedNode> lookup_class_candidates(
    const SideIndexes& indexes,
    std::size_t        class_hash);

std::vector<CollectedNode> lookup_usage_candidates(
    const SideIndexes& indexes,
    std::size_t        usage_hash);
