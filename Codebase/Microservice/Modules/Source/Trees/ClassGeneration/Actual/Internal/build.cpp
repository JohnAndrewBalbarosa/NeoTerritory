#include "Trees/Actual/Internal/contracts.hpp"

void rehash_subtree(ParseTreeNode& subtree_root, std::size_t parent_hash)
{
    subtree_root.parent_hash = parent_hash;
    for (ParseTreeNode& child : subtree_root.children)
    {
        rehash_subtree(child, subtree_root.hash);
    }
}

std::size_t derive_child_context_hash(std::size_t parent_hash, const std::string& child_token)
{
    return hash_combine_token(parent_hash, child_token);
}

std::size_t hash_class_name_with_file(const std::string& class_name, const std::string& file_name)
{
    const std::size_t file_hash = make_fnv1a64_hash_id(file_name);
    return hash_combine_token(file_hash, class_name);
}
