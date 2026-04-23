#include "Internal/parse_tree_hash_links_internal.hpp"

#include <cstddef>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace parse_tree_hash_links_internal
{
void collect_side_nodes(
    const ParseTreeNode& root,
    const std::string& tree_side,
    SideIndexes& out)
{
    const size_t tree_side_hash = std::hash<std::string>{}(tree_side);

    for (const ParseTreeNode& file_node : root.children)
    {
        if (file_node.kind != "FileUnit")
        {
            continue;
        }

        const std::string file_path = file_node.value;
        const std::string basename = file_basename(file_path);

        std::vector<std::string> prefix_readable = {
            chain_entry(root.kind, root.value),
            "FileUnit:" + basename,
            tree_side == "actual" ? "ActualParseTree" : "VirtualParseTree",
        };
        std::vector<size_t> prefix_hashes = {
            root.contextual_hash,
            file_node.contextual_hash,
            tree_side_hash,
        };

        std::function<void(const ParseTreeNode&, const std::vector<size_t>&, const std::vector<std::string>&, const std::vector<size_t>&)> walk;
        walk = [&](const ParseTreeNode& node,
                   const std::vector<size_t>& index_path,
                   const std::vector<std::string>& ancestry_prefix,
                   const std::vector<size_t>& hash_prefix) {
            NodeRef ref;
            ref.tree_side = tree_side;
            ref.file_basename = basename;
            ref.file_path = file_path;
            ref.node_kind = node.kind;
            ref.node_value = node.value;
            ref.contextual_hash = node.contextual_hash;
            ref.node_index_path = index_path;

            ref.ancestry.readable_chain = ancestry_prefix;
            ref.ancestry.readable_chain.push_back(chain_entry(node.kind, node.value));

            ref.ancestry.hash_chain = hash_prefix;
            ref.ancestry.hash_chain.push_back(node.contextual_hash);

            CollectedNode collected;
            collected.ref = std::move(ref);
            collected.is_class_declaration = is_class_declaration_node(node);
            if (collected.is_class_declaration)
            {
                collected.class_name = class_name_from_signature(node.value);
                collected.class_name_hash = std::hash<std::string>{}(collected.class_name);
            }

            const size_t node_index = out.nodes.size();
            out.nodes.push_back(std::move(collected));

            out.contextual_by_file[file_path][node.contextual_hash].push_back(node_index);
            for (size_t usage_hash : node.propagated_usage_hashes)
            {
                out.usage_by_file[file_path][usage_hash].push_back(node_index);
            }

            const CollectedNode& node_meta = out.nodes[node_index];
            if (node_meta.is_class_declaration && !node_meta.class_name.empty())
            {
                out.class_decl_by_name_hash[node_meta.class_name_hash].push_back(node_index);
                out.class_decl_by_exact_name[node_meta.class_name].push_back(node_index);
            }

            for (size_t child_i = 0; child_i < node.children.size(); ++child_i)
            {
                std::vector<size_t> child_path = index_path;
                child_path.push_back(child_i);
                walk(
                    node.children[child_i],
                    child_path,
                    out.nodes[node_index].ref.ancestry.readable_chain,
                    out.nodes[node_index].ref.ancestry.hash_chain);
            }
        };

        for (size_t child_i = 0; child_i < file_node.children.size(); ++child_i)
        {
            std::vector<size_t> index_path = {child_i};
            walk(file_node.children[child_i], index_path, prefix_readable, prefix_hashes);
        }
    }
}

std::vector<NodeRef> build_node_refs(const SideIndexes& side, const std::vector<size_t>& node_indices)
{
    std::vector<NodeRef> refs;
    refs.reserve(node_indices.size());
    for (size_t idx : node_indices)
    {
        if (idx >= side.nodes.size())
        {
            continue;
        }
        refs.push_back(side.nodes[idx].ref);
    }
    return refs;
}

std::vector<size_t> lookup_class_candidates(const SideIndexes& side, size_t class_name_hash)
{
    const auto hit = side.class_decl_by_name_hash.find(class_name_hash);
    if (hit == side.class_decl_by_name_hash.end())
    {
        return {};
    }
    return hit->second;
}

std::vector<size_t> lookup_usage_candidates(
    const SideIndexes& side,
    const std::string& file_path,
    size_t outgoing_hash,
    const std::vector<size_t>& hash_chain)
{
    const auto file_hit = side.usage_by_file.find(file_path);
    if (file_hit == side.usage_by_file.end())
    {
        return {};
    }

    std::vector<size_t> out;
    const auto outgoing_hit = file_hit->second.find(outgoing_hash);
    if (outgoing_hit != file_hit->second.end())
    {
        out.insert(out.end(), outgoing_hit->second.begin(), outgoing_hit->second.end());
    }

    for (size_t h : hash_chain)
    {
        const auto chain_hit = file_hit->second.find(h);
        if (chain_hit != file_hit->second.end())
        {
            out.insert(out.end(), chain_hit->second.begin(), chain_hit->second.end());
        }
    }

    dedupe_keep_order(out);
    return out;
}
} // namespace parse_tree_hash_links_internal
