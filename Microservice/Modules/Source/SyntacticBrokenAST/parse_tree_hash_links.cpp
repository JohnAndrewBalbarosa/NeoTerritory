#include "parse_tree_hash_links.hpp"

#include "Internal/parse_tree_hash_links_internal.hpp"

#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

HashLinkIndex build_parse_tree_hash_links(
    const ParseTreeNode& actual_root,
    const ParseTreeNode& virtual_root,
    const ParseTreeSymbolTables& symbol_tables,
    const std::vector<LineHashTrace>& line_hash_traces)
{
    parse_tree_hash_links_internal::SideIndexes actual;
    parse_tree_hash_links_internal::SideIndexes virtual_side;
    parse_tree_hash_links_internal::collect_side_nodes(actual_root, "actual", actual);
    parse_tree_hash_links_internal::collect_side_nodes(virtual_root, "virtual", virtual_side);

    HashLinkIndex links;
    std::unordered_set<std::string> paired_files;
    auto add_file_pair = [&](const ParseTreeNode& root) {
        for (const ParseTreeNode& file_node : root.children)
        {
            if (file_node.kind != "FileUnit")
            {
                continue;
            }

            if (!paired_files.insert(file_node.value).second)
            {
                continue;
            }

            FilePairedTreeView view;
            view.file_path = file_node.value;
            view.file_basename = parse_tree_hash_links_internal::file_basename(file_node.value);
            view.actual_root_kind = "ActualParseTree";
            view.virtual_root_kind = "VirtualParseTree";
            links.paired_file_view.push_back(std::move(view));
        }
    };

    add_file_pair(actual_root);
    add_file_pair(virtual_root);

    for (const ParseSymbol& cls : class_symbol_table(symbol_tables))
    {
        ClassHashLink class_link;
        class_link.class_name = cls.name;
        class_link.class_name_hash = cls.name_hash;
        class_link.class_contextual_hash = cls.contextual_hash;
        class_link.file_path = cls.file_path;

        const std::vector<size_t> actual_candidates = parse_tree_hash_links_internal::lookup_class_candidates(actual, cls.name_hash);
        const parse_tree_hash_links_internal::ResolutionResult actual_resolution = parse_tree_hash_links_internal::resolve_candidates(
            actual,
            actual_candidates,
            cls.name,
            cls.file_path,
            cls.contextual_hash);
        class_link.actual_link_status = actual_resolution.status;
        class_link.actual_nodes = parse_tree_hash_links_internal::build_node_refs(actual, actual_resolution.node_indices);

        const std::vector<size_t> virtual_candidates = parse_tree_hash_links_internal::lookup_class_candidates(virtual_side, cls.name_hash);
        const parse_tree_hash_links_internal::ResolutionResult virtual_resolution = parse_tree_hash_links_internal::resolve_candidates(
            virtual_side,
            virtual_candidates,
            cls.name,
            cls.file_path,
            cls.contextual_hash);
        class_link.virtual_link_status = virtual_resolution.status;
        class_link.virtual_nodes = parse_tree_hash_links_internal::build_node_refs(virtual_side, virtual_resolution.node_indices);

        class_link.link_status = parse_tree_hash_links_internal::combine_status(class_link.actual_link_status, class_link.virtual_link_status);
        links.class_links.push_back(std::move(class_link));
    }

    for (const LineHashTrace& trace : line_hash_traces)
    {
        UsageHashLink usage_link;
        usage_link.file_path = trace.file_path;
        usage_link.line_number = trace.line_number;
        usage_link.class_name = trace.class_name;
        usage_link.class_name_hash = trace.class_name_hash;
        usage_link.matched_class_contextual_hash = trace.matched_class_contextual_hash;
        usage_link.outgoing_hash = trace.outgoing_hash;
        usage_link.hash_chain = trace.hash_chain;

        const std::vector<size_t> class_candidates_actual = parse_tree_hash_links_internal::lookup_class_candidates(actual, trace.class_name_hash);
        const parse_tree_hash_links_internal::ResolutionResult class_resolution_actual = parse_tree_hash_links_internal::resolve_candidates(
            actual,
            class_candidates_actual,
            trace.class_name,
            trace.file_path,
            trace.matched_class_contextual_hash);
        usage_link.class_anchor_actual_nodes = parse_tree_hash_links_internal::build_node_refs(actual, class_resolution_actual.node_indices);

        const std::vector<size_t> class_candidates_virtual = parse_tree_hash_links_internal::lookup_class_candidates(virtual_side, trace.class_name_hash);
        const parse_tree_hash_links_internal::ResolutionResult class_resolution_virtual = parse_tree_hash_links_internal::resolve_candidates(
            virtual_side,
            class_candidates_virtual,
            trace.class_name,
            trace.file_path,
            trace.matched_class_contextual_hash);
        usage_link.class_anchor_virtual_nodes = parse_tree_hash_links_internal::build_node_refs(virtual_side, class_resolution_virtual.node_indices);

        usage_link.class_link_status = parse_tree_hash_links_internal::combine_status(class_resolution_actual.status, class_resolution_virtual.status);

        const std::vector<size_t> usage_candidates_actual =
            parse_tree_hash_links_internal::lookup_usage_candidates(actual, trace.file_path, trace.outgoing_hash, trace.hash_chain);
        const parse_tree_hash_links_internal::ResolutionResult usage_resolution_actual = parse_tree_hash_links_internal::resolve_candidates(
            actual,
            usage_candidates_actual,
            "",
            trace.file_path,
            0);
        usage_link.usage_actual_nodes = parse_tree_hash_links_internal::build_node_refs(actual, usage_resolution_actual.node_indices);

        const std::vector<size_t> usage_candidates_virtual =
            parse_tree_hash_links_internal::lookup_usage_candidates(virtual_side, trace.file_path, trace.outgoing_hash, trace.hash_chain);
        const parse_tree_hash_links_internal::ResolutionResult usage_resolution_virtual = parse_tree_hash_links_internal::resolve_candidates(
            virtual_side,
            usage_candidates_virtual,
            "",
            trace.file_path,
            0);
        usage_link.usage_virtual_nodes = parse_tree_hash_links_internal::build_node_refs(virtual_side, usage_resolution_virtual.node_indices);

        usage_link.usage_link_status = parse_tree_hash_links_internal::combine_status(usage_resolution_actual.status, usage_resolution_virtual.status);

        links.usage_links.push_back(std::move(usage_link));
    }

    return links;
}
