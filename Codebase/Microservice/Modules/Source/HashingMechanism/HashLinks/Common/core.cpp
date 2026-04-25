#include "HashingMechanism/HashLinks/Internal/contracts.hpp"

std::size_t chain_entry(const NodeAncestry& ancestry, std::size_t depth)
{
    if (depth >= ancestry.parent_hashes.size())
    {
        return 0;
    }
    return ancestry.parent_hashes[depth];
}

std::size_t parent_tail_key(const NodeAncestry& ancestry)
{
    if (ancestry.parent_hashes.empty())
    {
        return 0;
    }
    return ancestry.parent_hashes.back();
}

int compare_index_paths(const NodeAncestry& left, const NodeAncestry& right)
{
    const std::size_t common_size = std::min(left.parent_hashes.size(), right.parent_hashes.size());
    for (std::size_t index = 0; index < common_size; ++index)
    {
        if (left.parent_hashes[index] < right.parent_hashes[index]) return -1;
        if (left.parent_hashes[index] > right.parent_hashes[index]) return  1;
    }
    if (left.parent_hashes.size() < right.parent_hashes.size()) return -1;
    if (left.parent_hashes.size() > right.parent_hashes.size()) return  1;
    return 0;
}

std::vector<CollectedNode> dedupe_keep_order(const std::vector<CollectedNode>& nodes)
{
    std::vector<CollectedNode> result;
    result.reserve(nodes.size());
    for (const CollectedNode& candidate : nodes)
    {
        bool found = false;
        for (const CollectedNode& existing : result)
        {
            if (existing.hash == candidate.hash && existing.node == candidate.node)
            {
                found = true;
                break;
            }
        }
        if (!found)
        {
            result.push_back(candidate);
        }
    }
    return result;
}

bool combine_status(bool current, bool next)
{
    return current && next;
}

std::vector<NodeRef> build_node_refs(const std::vector<CollectedNode>& nodes)
{
    std::vector<NodeRef> refs;
    refs.reserve(nodes.size());
    for (const CollectedNode& node : nodes)
    {
        NodeRef ref;
        ref.hash = node.hash;
        ref.node = node.node;
        refs.push_back(ref);
    }
    return refs;
}
