#include "Diffing/core.hpp"

#include <algorithm>

namespace
{
bool interval_is_valid(const SourceChangeInterval& interval)
{
    return !interval.file_path.empty() &&
           interval.start_line > 0 &&
           interval.end_line >= interval.start_line;
}

void find_first_matching_file_node(
    const ParseTreeNode& node,
    const std::string& file_path,
    std::vector<size_t>& path,
    AffectedSubtreeRef& out)
{
    if (out.found)
    {
        return;
    }

    if (node.kind == "FileUnit" && node.value == file_path)
    {
        out.file_path = file_path;
        out.node_path = path;
        out.node_kind = node.kind;
        out.node_value = node.value;
        out.found = true;
        return;
    }

    for (size_t i = 0; i < node.children.size(); ++i)
    {
        path.push_back(i);
        find_first_matching_file_node(node.children[i], file_path, path, out);
        path.pop_back();
        if (out.found)
        {
            return;
        }
    }
}

AffectedSubtreeRef locate_affected_subtree_scaffold(
    const SourceChangeInterval& interval,
    const ParseTreeNode& actual_tree)
{
    AffectedSubtreeRef ref;
    if (!interval_is_valid(interval))
    {
        return ref;
    }

    std::vector<size_t> path;
    find_first_matching_file_node(actual_tree, interval.file_path, path, ref);
    return ref;
}

bool virtual_tree_mentions_file(const ParseTreeNode& node, const std::string& file_path)
{
    if (node.kind == "FileUnit" && node.value == file_path)
    {
        return true;
    }

    return std::any_of(
        node.children.begin(),
        node.children.end(),
        [&](const ParseTreeNode& child) {
            return virtual_tree_mentions_file(child, file_path);
        });
}

LexicalRefreshSummary refresh_lexical_structure_scaffold(const SourceChangeInterval& interval)
{
    LexicalRefreshSummary summary;
    summary.refreshed = interval_is_valid(interval);
    if (summary.refreshed)
    {
        summary.structure_events.push_back("changed_region_scheduled_for_lexical_refresh");
    }
    return summary;
}

PatternOwnershipState classify_pattern_ownership_scaffold(const AffectedSubtreeRef& affected)
{
    if (!affected.found)
    {
        return PatternOwnershipState::Unknown;
    }
    return affected.has_virtual_equivalent
        ? PatternOwnershipState::PatternOwnedChanged
        : PatternOwnershipState::OutsidePatternChanged;
}

SubtreeDiffResult compare_subtrees_scaffold(const AffectedSubtreeRef& affected)
{
    SubtreeDiffResult result;
    result.equivalent_subtree_found = affected.has_virtual_equivalent;
    result.structural_delta_found = affected.found;
    if (affected.found)
    {
        result.affected_actual_node_paths.push_back(affected.node_path);
    }
    return result;
}

void append_regeneration_actions(DiffRegenerationPlan& plan)
{
    plan.actions.push_back(RegenerationAction::RefreshLexicalStructure);

    switch (plan.ownership)
    {
    case PatternOwnershipState::PatternOwnedChanged:
        plan.actions.push_back(RegenerationAction::RegenerateVirtualSubtree);
        plan.actions.push_back(RegenerationAction::RegenerateActualSubtree);
        break;
    case PatternOwnershipState::OutsidePatternChanged:
        plan.actions.push_back(RegenerationAction::RegenerateActualSubtree);
        break;
    case PatternOwnershipState::BecamePatternCandidate:
        plan.actions.push_back(RegenerationAction::RegenerateActualSubtree);
        plan.actions.push_back(RegenerationAction::AttachVirtualSubtree);
        break;
    case PatternOwnershipState::PatternStructureRemoved:
        plan.actions.push_back(RegenerationAction::DiscardVirtualSubtree);
        plan.actions.push_back(RegenerationAction::RegenerateActualSubtree);
        break;
    case PatternOwnershipState::Unknown:
        plan.notes.push_back("no affected subtree found");
        break;
    }

    if (plan.affected_subtree.found)
    {
        plan.actions.push_back(RegenerationAction::RefreshScopedHashes);
        plan.actions.push_back(RegenerationAction::NotifyOutputGeneration);
    }
}
} // namespace

DiffRegenerationPlan plan_interval_subtree_regeneration(
    const SourceChangeInterval& interval,
    const ParseTreeNode& actual_tree,
    const ParseTreeNode& virtual_tree)
{
    DiffRegenerationPlan plan;
    plan.interval = interval;
    plan.lexical_refresh = refresh_lexical_structure_scaffold(interval);
    plan.affected_subtree = locate_affected_subtree_scaffold(interval, actual_tree);
    plan.affected_subtree.has_virtual_equivalent =
        plan.affected_subtree.found &&
        virtual_tree_mentions_file(virtual_tree, plan.affected_subtree.file_path);
    plan.ownership = classify_pattern_ownership_scaffold(plan.affected_subtree);
    plan.subtree_diff = compare_subtrees_scaffold(plan.affected_subtree);

    if (!plan.lexical_refresh.refreshed)
    {
        plan.notes.push_back("invalid interval; lexical refresh skipped");
    }

    append_regeneration_actions(plan);
    return plan;
}

std::string pattern_ownership_state_to_string(PatternOwnershipState state)
{
    switch (state)
    {
    case PatternOwnershipState::PatternOwnedChanged:
        return "pattern_owned_changed";
    case PatternOwnershipState::OutsidePatternChanged:
        return "outside_pattern_changed";
    case PatternOwnershipState::BecamePatternCandidate:
        return "became_pattern_candidate";
    case PatternOwnershipState::PatternStructureRemoved:
        return "pattern_structure_removed";
    case PatternOwnershipState::Unknown:
        return "unknown";
    }
    return "unknown";
}

std::string regeneration_action_to_string(RegenerationAction action)
{
    switch (action)
    {
    case RegenerationAction::RefreshLexicalStructure:
        return "refresh_lexical_structure";
    case RegenerationAction::RegenerateVirtualSubtree:
        return "regenerate_virtual_subtree";
    case RegenerationAction::RegenerateActualSubtree:
        return "regenerate_actual_subtree";
    case RegenerationAction::AttachVirtualSubtree:
        return "attach_virtual_subtree";
    case RegenerationAction::DiscardVirtualSubtree:
        return "discard_virtual_subtree";
    case RegenerationAction::RefreshScopedHashes:
        return "refresh_scoped_hashes";
    case RegenerationAction::NotifyOutputGeneration:
        return "notify_output_generation";
    }
    return "unknown";
}
