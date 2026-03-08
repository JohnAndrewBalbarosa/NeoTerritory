#include "Internal/parse_tree_internal.hpp"

#include <cstdint>
#include <functional>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>

namespace parse_tree_internal
{
size_t hash_combine_token(size_t seed, const std::string& token)
{
    return std::hash<std::string>{}(std::to_string(seed) + "|" + token);
}

std::string make_fnv1a64_hash_id(const std::string& token)
{
    const uint64_t fnv_offset_basis = 14695981039346656037ull;
    const uint64_t fnv_prime = 1099511628211ull;

    uint64_t hash = fnv_offset_basis;
    for (unsigned char c : token)
    {
        hash ^= static_cast<uint64_t>(c);
        hash *= fnv_prime;
    }

    std::ostringstream out;
    out << "fnv1a64:";
    out << std::hex << std::setfill('0') << std::setw(16) << hash;
    return out.str();
}

size_t derive_child_context_hash(
    size_t parent_hash,
    const std::string& kind,
    const std::string& value,
    size_t sibling_index)
{
    return std::hash<std::string>{}(
        std::to_string(parent_hash) +
        "|" + kind +
        "|" + value +
        "|" + std::to_string(sibling_index));
}

size_t hash_class_name_with_file(const std::string& file_path, const std::string& class_name)
{
    return std::hash<std::string>{}(file_path + "|" + class_name);
}

void rehash_subtree(ParseTreeNode& node, size_t parent_hash, size_t sibling_index)
{
    node.contextual_hash = derive_child_context_hash(parent_hash, node.kind, node.value, sibling_index);
    for (size_t i = 0; i < node.children.size(); ++i)
    {
        rehash_subtree(node.children[i], node.contextual_hash, i);
    }
}

void add_unique_hash(std::vector<size_t>& hashes, size_t hash_value)
{
    for (size_t existing : hashes)
    {
        if (existing == hash_value)
        {
            return;
        }
    }
    hashes.push_back(hash_value);
}

std::string usage_hash_suffix(const std::vector<size_t>& active_usage_hashes)
{
    if (active_usage_hashes.empty())
    {
        return {};
    }

    std::ostringstream out;
    out << "@[";
    for (size_t i = 0; i < active_usage_hashes.size(); ++i)
    {
        if (i > 0)
        {
            out << ",";
        }
        out << active_usage_hashes[i];
    }
    out << "]";
    return out.str();
}

std::string usage_hash_list(const std::vector<size_t>& usage_hashes)
{
    if (usage_hashes.empty())
    {
        return {};
    }

    std::ostringstream out;
    for (size_t i = 0; i < usage_hashes.size(); ++i)
    {
        if (i > 0)
        {
            out << ",";
        }
        out << usage_hashes[i];
    }
    return out.str();
}
} // namespace parse_tree_internal
