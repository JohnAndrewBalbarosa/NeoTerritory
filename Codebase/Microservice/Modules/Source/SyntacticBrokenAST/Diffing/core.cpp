#include "Diffing/core.hpp"

#include "Internal/parse_tree_internal.hpp"
#include "Language-and-Structure/lexical_structure_hooks.hpp"

#include <algorithm>

namespace
{
bool interval_is_valid(const SourceChangeInterval& interval)
{
    return !interval.file_path.empty() &&
           interval.start_line > 0 &&
           interval.end_line >= interval.start_line;
}

// Scaffold adapter: call the real lexical refresh entrypoint instead of
// returning a static placeholder event. The verifier still has a TODO to
// populate real per-class signals, but the control-plane wiring is now
// routed through Language-and-Structure.
LexicalRefreshSummary refresh_lexical_structure_via_hook(const SourceChangeInterval& interval)
{
    LexicalRefreshSummary summary;
    if (!interval_is_valid(interval))
    {
        summary.notes.push_back("invalid interval; lexical refresh skipped");
        return summary;
    }

    LexicalIntervalRefreshInput input;
    input.file_path = interval.file_path;
    input.source = interval.changed_source;
    input.start_line = interval.start_line;
    input.end_line = interval.end_line;
    input.source_pattern = interval.source_pattern;

    StructuralAnalysisState local_state;
    reset_structural_analysis_state(local_state);
    const LexicalIntervalRefreshOutput output =
        refresh_lexical_structure_for_interval(input, local_state);

    summary.refreshed = output.refreshed;
    summary.class_boundary_seen = output.class_boundary_seen;
    summary.hard_violation_seen = output.hard_violation_seen;
    summary.affected_class_name = output.affected_class_name;
    summary.notes = output.notes;
    summary.structure_events.reserve(output.structure_events.size());
    for (const StructuralLexicalEvent& event : output.structure_events)
    {
        summary.structure_events.push_back(event.token);
    }
    return summary;
}

AffectedSubtreeRef to_subtree_ref(const parse_tree_internal::AffectedSubtreeLocation& loc)
{
    AffectedSubtreeRef ref;
    ref.found = loc.found;
    ref.has_virtual_equivalent = loc.has_virtual_equivalent;
    ref.file_path = loc.file_path;
    ref.node_path = loc.node_path;
    ref.node_kind = loc.node_kind;
    ref.node_value = loc.node_value;
    return ref;
}

PatternOwnershipState classify_pattern_ownership_scaffold(
    const parse_tree_internal::AffectedSubtreeLocation& loc,
    const LexicalRefreshSummary& refresh)
{
    if (!loc.found)
    {
        return PatternOwnershipState::Unknown;
    }

    if (refresh.hard_violation_seen && loc.has_virtual_equivalent)
    {
        return PatternOwnershipState::PatternStructureRemoved;
    }
    if (loc.has_virtual_equivalent)
    {
        return PatternOwnershipState::PatternOwnedChanged;
    }
    if (refresh.class_boundary_seen && !loc.has_virtual_equivalent)
    {
        return PatternOwnershipState::BecamePatternCandidate;
    }
    return PatternOwnershipState::OutsidePatternChanged;
}

SubtreeDiffResult compare_subtrees_scaffold(const parse_tree_internal::AffectedSubtreeLocation& loc)
{
    SubtreeDiffResult result;
    result.equivalent_subtree_found = loc.has_virtual_equivalent;
    result.structural_delta_found = loc.found;
    if (loc.found)
    {
        result.affected_actual_node_paths.push_back(loc.node_path);
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

    // 1) Lexical refresh for the changed region first. Interval diffing
    //    must reuse lexical structural analysis instead of scanning twice.
    plan.lexical_refresh = refresh_lexical_structure_via_hook(interval);

    // 2) Use line metadata only to locate the smallest safe actual
    //    subtree. Line ranges are locator metadata, not the diff itself.
    const parse_tree_internal::AffectedSubtreeLocation location =
        parse_tree_internal::locate_affected_subtree_by_interval(
            actual_tree,
            virtual_tree,
            interval.file_path,
            interval.start_line,
            interval.end_line);

    plan.affected_subtree = to_subtree_ref(location);

    // 3) Classify ownership using refreshed structural signals plus
    //    virtual-equivalence presence. Never classify from raw line ranges.
    plan.ownership = classify_pattern_ownership_scaffold(location, plan.lexical_refresh);

    // 4) Summarize the subtree comparison for downstream consumers.
    plan.subtree_diff = compare_subtrees_scaffold(location);

    // 5) Build the scoped regeneration plan. The coordinator returns a
    //    plan; it never performs full regeneration directly.
    append_regeneration_actions(plan);

    // Carry lexical notes into plan notes so downstream readers can see
    // why a refresh was skipped or flagged.
    for (const std::string& note : plan.lexical_refresh.notes)
    {
        plan.notes.push_back(note);
    }

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
