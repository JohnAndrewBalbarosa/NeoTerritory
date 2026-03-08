#ifndef PARSE_TREE_HASH_LINKS_HPP
#define PARSE_TREE_HASH_LINKS_HPP

#include "parse_tree.hpp"
#include "parse_tree_symbols.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct NodeAncestry
{
    std::vector<std::string> readable_chain;
    std::vector<size_t> hash_chain;
};

struct NodeRef
{
    std::string tree_side;
    std::string file_basename;
    std::string file_path;
    std::string node_kind;
    std::string node_value;
    size_t contextual_hash = 0;
    std::vector<size_t> node_index_path;
    NodeAncestry ancestry;
};

struct FilePairedTreeView
{
    std::string file_basename;
    std::string file_path;
    std::string actual_root_kind;
    std::string virtual_root_kind;
};

struct ClassHashLink
{
    std::string class_name;
    size_t class_name_hash = 0;
    size_t class_contextual_hash = 0;
    std::string file_path;
    std::string actual_link_status;
    std::string virtual_link_status;
    std::string link_status;
    std::vector<NodeRef> actual_nodes;
    std::vector<NodeRef> virtual_nodes;
};

struct UsageHashLink
{
    std::string file_path;
    size_t line_number = 0;
    std::string class_name;
    size_t class_name_hash = 0;
    size_t matched_class_contextual_hash = 0;
    size_t outgoing_hash = 0;
    std::vector<size_t> hash_chain;
    std::string class_link_status;
    std::vector<NodeRef> class_anchor_actual_nodes;
    std::vector<NodeRef> class_anchor_virtual_nodes;
    std::string usage_link_status;
    std::vector<NodeRef> usage_actual_nodes;
    std::vector<NodeRef> usage_virtual_nodes;
};

struct HashLinkIndex
{
    std::vector<FilePairedTreeView> paired_file_view;
    std::vector<ClassHashLink> class_links;
    std::vector<UsageHashLink> usage_links;
};

HashLinkIndex build_parse_tree_hash_links(
    const ParseTreeNode& actual_root,
    const ParseTreeNode& virtual_root,
    const ParseTreeSymbolTables& symbol_tables,
    const std::vector<LineHashTrace>& line_hash_traces);

#endif // PARSE_TREE_HASH_LINKS_HPP
