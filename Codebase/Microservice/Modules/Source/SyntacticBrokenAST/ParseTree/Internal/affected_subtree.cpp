#include "Internal/parse_tree_internal.hpp"

#include <cstddef>
#include <string>
#include <vector>

namespace parse_tree_internal
{
namespace
{
bool node_covers_interval(const ParseTreeNode& node, size_t start_line, size_t end_line)
{
    if (node.source_line_start == 0 || node.source_line_end == 0)
    {
        return false;
    }
    return node.source_line_start <= start_line && node.source_line_end >= end_line;
}

bool node_touches_interval(const ParseTreeNode& node, size_t start_line, size_t end_line)
{
    if (node.source_line_start == 0 || node.source_line_end == 0)
    {
        return false;
    }
    const bool starts_before = node.source_line_start <= end_line;
    const bool ends_after = node.source_line_end >= start_line;
    return starts_before && ends_after;
}

bool find_smallest_covering_node(
    const ParseTreeNode& node,
    size_t start_line,
    size_t end_line,
    std::vector<size_t>& path,
    AffectedSubtreeLocation& out)
{
    bool found_here = node_covers_interval(node, start_line, end_line);
    bool found_deeper = false;

    for (size_t i = 0; i < node.children.size(); ++i)
    {
        path.push_back(i);
        if (find_smallest_covering_node(node.children[i], start_line, end_line, path, out))
        {
            found_deeper = true;
            path.pop_back();
            return true;
        }
        path.pop_back();
    }

    if (found_here && !found_deeper)
    {
        out.found = true;
        out.node_path = path;
        out.node_kind = node.kind;
        out.node_value = node.value;
        out.source_line_start = node.source_line_start;
        out.source_line_end = node.source_line_end;
        return true;
    }
    return false;
}

const ParseTreeNode* find_file_node(const ParseTreeNode& root, const std::string& file_path)
{
    if (root.kind == "FileUnit" && root.value == file_path)
    {
        return &root;
    }
    for (const ParseTreeNode& child : root.children)
    {
        if (const ParseTreeNode* hit = find_file_node(child, file_path))
        {
            return hit;
        }
    }
    return nullptr;
}
} // namespace

AffectedSubtreeLocation locate_affected_subtree_by_interval(
    const ParseTreeNode& actual_tree_root,
    const ParseTreeNode& virtual_tree_root,
    const std::string& file_path,
    size_t start_line,
    size_t end_line)
{
    AffectedSubtreeLocation location;
    location.file_path = file_path;

    if (file_path.empty() || start_line == 0 || end_line < start_line)
    {
        return location;
    }

    const ParseTreeNode* actual_file = find_file_node(actual_tree_root, file_path);
    if (actual_file == nullptr)
    {
        return location;
    }

    std::vector<size_t> path;
    // Note: path here is relative to the file node, not the tree root.
    // The diffing coordinator treats this as a node-path inside the file.
    if (!find_smallest_covering_node(*actual_file, start_line, end_line, path, location))
    {
        // Fall back to touches-interval on direct children so diffing still
        // has a target when node metadata hasn't been populated yet.
        for (size_t i = 0; i < actual_file->children.size(); ++i)
        {
            if (node_touches_interval(actual_file->children[i], start_line, end_line))
            {
                location.found = true;
                location.node_path = {i};
                location.node_kind = actual_file->children[i].kind;
                location.node_value = actual_file->children[i].value;
                location.source_line_start = actual_file->children[i].source_line_start;
                location.source_line_end = actual_file->children[i].source_line_end;
                break;
            }
        }
    }

    if (location.found)
    {
        const ParseTreeNode* virtual_file = find_file_node(virtual_tree_root, file_path);
        location.has_virtual_equivalent = virtual_file != nullptr && !virtual_file->children.empty();
    }
    return location;
}

bool regenerate_actual_subtree_placeholder(
    ParseTreeNode& /*actual_tree_root*/,
    const AffectedSubtreeLocation& location,
    std::vector<std::string>& notes)
{
    if (!location.found)
    {
        notes.push_back("actual_regen_skipped_no_location");
        return false;
    }
    // TODO: rebuild the affected actual subtree by re-running the parse
    // loop over the affected line range and swapping the node in place.
    notes.push_back("actual_regen_scaffold_only");
    return true;
}

bool regenerate_virtual_subtree_placeholder(
    ParseTreeNode& /*virtual_tree_root*/,
    const AffectedSubtreeLocation& location,
    std::vector<std::string>& notes)
{
    if (!location.found || !location.has_virtual_equivalent)
    {
        notes.push_back("virtual_regen_skipped_no_equivalent");
        return false;
    }
    // TODO: re-run the class-local structural verifier for the affected
    // class region and rebuild the detached virtual-broken subtree before
    // comparing it to the actual equivalent.
    notes.push_back("virtual_regen_scaffold_only");
    return true;
}
} // namespace parse_tree_internal
