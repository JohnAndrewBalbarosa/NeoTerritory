#include "Internal/parse_tree_internal.hpp"

#include <utility>
#include <vector>

namespace parse_tree_internal
{
ParseTreeNode* node_at_path(ParseTreeNode& root, const std::vector<size_t>& path)
{
    ParseTreeNode* target = &root;
    for (size_t idx : path)
    {
        if (idx >= target->children.size())
        {
            return nullptr;
        }
        target = &target->children[idx];
    }
    return target;
}

const ParseTreeNode* node_at_path(const ParseTreeNode& root, const std::vector<size_t>& path)
{
    const ParseTreeNode* target = &root;
    for (size_t idx : path)
    {
        if (idx >= target->children.size())
        {
            return nullptr;
        }
        target = &target->children[idx];
    }
    return target;
}

size_t append_node_at_path(ParseTreeNode& root, const std::vector<size_t>& path, ParseTreeNode node)
{
    ParseTreeNode* target = node_at_path(root, path);
    if (target == nullptr)
    {
        return 0;
    }

    const size_t sibling_index = target->children.size();
    node.contextual_hash = derive_child_context_hash(target->contextual_hash, node.kind, node.value, sibling_index);
    target->children.push_back(std::move(node));
    return sibling_index;
}
} // namespace parse_tree_internal
