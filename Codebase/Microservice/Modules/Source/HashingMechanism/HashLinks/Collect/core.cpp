#include "HashingMechanism/HashLinks/Internal/contracts.hpp"

std::vector<CollectedNode> collect_side_nodes(const ParseTreeNode&, const std::string&)
{
    return {};
}

std::vector<CollectedNode> lookup_class_candidates(const SideIndexes& indexes, std::size_t class_hash)
{
    auto iterator = indexes.by_class_hash.find(class_hash);
    if (iterator == indexes.by_class_hash.end())
    {
        return {};
    }
    return iterator->second;
}

std::vector<CollectedNode> lookup_usage_candidates(const SideIndexes& indexes, std::size_t usage_hash)
{
    auto iterator = indexes.by_function_hash.find(usage_hash);
    if (iterator == indexes.by_function_hash.end())
    {
        return {};
    }
    return iterator->second;
}
