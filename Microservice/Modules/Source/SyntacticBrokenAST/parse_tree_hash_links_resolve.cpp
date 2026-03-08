#include "Internal/parse_tree_hash_links_internal.hpp"

#include <algorithm>
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

namespace parse_tree_hash_links_internal
{
ResolutionResult resolve_candidates(
    const SideIndexes& side,
    std::vector<size_t> candidates,
    const std::string& expected_class_name,
    const std::string& expected_file_path,
    size_t preferred_contextual_hash)
{
    dedupe_keep_order(candidates);
    if (candidates.empty())
    {
        return {"unresolved", {}};
    }

    const std::string expected_basename = file_basename(expected_file_path);

    if (!expected_class_name.empty())
    {
        std::vector<size_t> exact_name;
        for (size_t idx : candidates)
        {
            if (idx >= side.nodes.size())
            {
                continue;
            }
            const CollectedNode& node = side.nodes[idx];
            if (node.is_class_declaration && node.class_name == expected_class_name)
            {
                exact_name.push_back(idx);
            }
        }
        if (!exact_name.empty())
        {
            candidates = std::move(exact_name);
        }
    }

    if (candidates.size() == 1)
    {
        return {"unique", candidates};
    }

    if (preferred_contextual_hash != 0)
    {
        std::vector<size_t> preferred;
        for (size_t idx : candidates)
        {
            if (idx >= side.nodes.size())
            {
                continue;
            }
            if (side.nodes[idx].ref.contextual_hash == preferred_contextual_hash)
            {
                preferred.push_back(idx);
            }
        }
        if (!preferred.empty())
        {
            candidates = std::move(preferred);
        }
    }

    if (candidates.size() == 1)
    {
        return {"unique", candidates};
    }

    size_t reference_idx = candidates.front();
    if (!expected_basename.empty())
    {
        for (size_t idx : candidates)
        {
            if (idx >= side.nodes.size())
            {
                continue;
            }
            if (side.nodes[idx].ref.file_basename == expected_basename)
            {
                reference_idx = idx;
                break;
            }
        }
    }

    const NodeRef& reference = side.nodes[reference_idx].ref;
    const size_t max_parent_depth =
        reference.ancestry.readable_chain.size() > 1
            ? reference.ancestry.readable_chain.size() - 1
            : 0;

    for (size_t depth = 1; depth <= max_parent_depth && candidates.size() > 1; ++depth)
    {
        const std::string key = parent_tail_key(reference, depth);
        std::vector<size_t> filtered;
        for (size_t idx : candidates)
        {
            if (idx >= side.nodes.size())
            {
                continue;
            }
            if (parent_tail_key(side.nodes[idx].ref, depth) == key)
            {
                filtered.push_back(idx);
            }
        }
        if (!filtered.empty())
        {
            candidates = std::move(filtered);
        }
    }

    if (candidates.size() > 1 && !expected_basename.empty())
    {
        std::vector<size_t> by_basename;
        for (size_t idx : candidates)
        {
            if (idx >= side.nodes.size())
            {
                continue;
            }
            if (side.nodes[idx].ref.file_basename == expected_basename)
            {
                by_basename.push_back(idx);
            }
        }
        if (!by_basename.empty())
        {
            candidates = std::move(by_basename);
        }
    }

    if (candidates.size() > 1 && !expected_file_path.empty())
    {
        std::vector<size_t> by_path;
        for (size_t idx : candidates)
        {
            if (idx >= side.nodes.size())
            {
                continue;
            }
            if (side.nodes[idx].ref.file_path == expected_file_path)
            {
                by_path.push_back(idx);
            }
        }
        if (!by_path.empty())
        {
            candidates = std::move(by_path);
        }
    }

    if (candidates.size() > 1)
    {
        std::sort(candidates.begin(), candidates.end(), [&](size_t lhs, size_t rhs) {
            if (lhs >= side.nodes.size())
            {
                return false;
            }
            if (rhs >= side.nodes.size())
            {
                return true;
            }

            const int cmp = compare_index_paths(side.nodes[lhs].ref.node_index_path, side.nodes[rhs].ref.node_index_path);
            if (cmp != 0)
            {
                return cmp < 0;
            }
            return lhs < rhs;
        });
        candidates.resize(1);
    }

    if (candidates.empty())
    {
        return {"unresolved", {}};
    }

    return {"unique", candidates};
}
} // namespace parse_tree_hash_links_internal
