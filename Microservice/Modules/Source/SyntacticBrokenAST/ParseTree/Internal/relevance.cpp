#include "Internal/parse_tree_internal.hpp"

#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

namespace parse_tree_internal
{
bool line_contains_any_tracked_token(
    const std::string& line_value,
    const std::unordered_set<std::string>& tracked_class_names,
    const std::unordered_set<std::string>& tracked_function_names)
{
    const std::vector<std::string> words = tokenize_text(line_value);
    for (const std::string& token : words)
    {
        if (tracked_class_names.find(token) != tracked_class_names.end())
        {
            return true;
        }
        if (tracked_function_names.find(token) != tracked_function_names.end())
        {
            return true;
        }
    }
    return false;
}

bool append_shadow_subtree_if_relevant(
    const ParseTreeNode& source,
    const std::unordered_set<std::string>& tracked_class_names,
    const std::unordered_set<std::string>& tracked_function_names,
    const std::unordered_set<size_t>* relevant_usage_hashes,
    size_t* kept_node_count,
    size_t* pruned_node_count,
    ParseTreeNode& out_shadow_node)
{
    std::vector<ParseTreeNode> kept_children;
    kept_children.reserve(source.children.size());

    for (const ParseTreeNode& child : source.children)
    {
        ParseTreeNode shadow_child;
        if (append_shadow_subtree_if_relevant(
                child,
                tracked_class_names,
                tracked_function_names,
                relevant_usage_hashes,
                kept_node_count,
                pruned_node_count,
                shadow_child))
        {
            kept_children.push_back(std::move(shadow_child));
        }
    }

    const bool tracked_value =
        line_contains_any_tracked_token(source.value, tracked_class_names, tracked_function_names) ||
        line_contains_any_tracked_token(source.annotated_value, tracked_class_names, tracked_function_names);

    bool hash_relevant = false;
    if (relevant_usage_hashes != nullptr && !relevant_usage_hashes->empty())
    {
        for (size_t usage_hash : source.propagated_usage_hashes)
        {
            if (relevant_usage_hashes->find(usage_hash) != relevant_usage_hashes->end())
            {
                hash_relevant = true;
                break;
            }
        }
    }

    const bool self_relevant = tracked_value || hash_relevant;

    if (source.kind == k_file_global_function_bucket_kind && kept_children.empty())
    {
        if (pruned_node_count != nullptr)
        {
            ++(*pruned_node_count);
        }
        return false;
    }

    if (!self_relevant && kept_children.empty())
    {
        if (pruned_node_count != nullptr)
        {
            ++(*pruned_node_count);
        }
        return false;
    }

    out_shadow_node.kind = source.kind;
    out_shadow_node.value = source.value;
    out_shadow_node.annotated_value = source.annotated_value;
    out_shadow_node.contextual_hash = source.contextual_hash;
    out_shadow_node.propagated_usage_hashes = source.propagated_usage_hashes;
    out_shadow_node.children = std::move(kept_children);
    if (kept_node_count != nullptr)
    {
        ++(*kept_node_count);
    }
    return true;
}
} // namespace parse_tree_internal
