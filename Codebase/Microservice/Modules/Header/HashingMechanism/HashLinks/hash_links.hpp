#pragma once

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

struct ParseTreeNode;
struct ParseTreeSymbolTables;

struct NodeAncestry
{
    std::vector<std::size_t> parent_hashes;
};

struct NodeRef
{
    std::size_t          hash = 0;
    const ParseTreeNode* node = nullptr;
};

struct FilePairedTreeView
{
    std::string          file_name;
    const ParseTreeNode* actual_root  = nullptr;
    const ParseTreeNode* virtual_root = nullptr;
};

struct ClassHashLink
{
    std::size_t          class_hash = 0;
    NodeRef              declaration;
    std::vector<NodeRef> usages;
};

struct UsageHashLink
{
    std::size_t target_hash = 0;
    NodeRef     usage_site;
    NodeRef     declaration;
};

struct HashLinkIndex
{
    std::unordered_map<std::size_t, NodeRef>       all_nodes;
    std::unordered_map<std::size_t, ClassHashLink> classes;
    std::vector<UsageHashLink>                     usages;
};

HashLinkIndex build_parse_tree_hash_links(
    const FilePairedTreeView&    file_view,
    const ParseTreeSymbolTables& symbol_tables);
