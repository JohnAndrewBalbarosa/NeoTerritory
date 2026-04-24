#ifndef DIFFING_CORE_HPP
#define DIFFING_CORE_HPP

#include "Language-and-Structure/lexical_structure_hooks.hpp"
#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct SourceChangeInterval
{
    std::string file_path;
    std::string changed_source;
    std::string source_pattern;
    size_t start_line = 0;
    size_t end_line = 0;
};

struct LexicalRefreshSummary
{
    bool refreshed = false;
    bool class_boundary_seen = false;
    bool hard_violation_seen = false;
    std::string affected_class_name;
    std::vector<std::string> structure_events;
    std::vector<std::string> notes;
};

struct AffectedSubtreeRef
{
    std::string file_path;
    std::vector<size_t> node_path;
    std::string node_kind;
    std::string node_value;
    bool found = false;
    bool has_virtual_equivalent = false;
};

enum class PatternOwnershipState
{
    Unknown,
    PatternOwnedChanged,
    OutsidePatternChanged,
    BecamePatternCandidate,
    PatternStructureRemoved,
};

enum class RegenerationAction
{
    RefreshLexicalStructure,
    RegenerateVirtualSubtree,
    RegenerateActualSubtree,
    AttachVirtualSubtree,
    DiscardVirtualSubtree,
    RefreshScopedHashes,
    NotifyOutputGeneration,
};

struct SubtreeDiffResult
{
    bool equivalent_subtree_found = false;
    bool structural_delta_found = false;
    std::vector<std::vector<size_t>> affected_actual_node_paths;
};

struct DiffRegenerationPlan
{
    SourceChangeInterval interval;
    LexicalRefreshSummary lexical_refresh;
    AffectedSubtreeRef affected_subtree;
    PatternOwnershipState ownership = PatternOwnershipState::Unknown;
    SubtreeDiffResult subtree_diff;
    std::vector<RegenerationAction> actions;
    std::vector<std::string> notes;
};

DiffRegenerationPlan plan_interval_subtree_regeneration(
    const SourceChangeInterval& interval,
    const ParseTreeNode& actual_tree,
    const ParseTreeNode& virtual_tree);

std::string pattern_ownership_state_to_string(PatternOwnershipState state);
std::string regeneration_action_to_string(RegenerationAction action);

#endif // DIFFING_CORE_HPP
