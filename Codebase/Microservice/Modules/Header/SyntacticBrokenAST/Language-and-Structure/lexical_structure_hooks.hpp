#ifndef LEXICAL_STRUCTURE_HOOKS_HPP
#define LEXICAL_STRUCTURE_HOOKS_HPP

#include "Pipeline-Contracts/analysis_context.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct CrucialClassInfo
{
    std::string name;
    size_t class_name_hash;
    std::string strategy_name;
};

enum class StructuralVerificationStatus
{
    Idle,
    Tracking,
    Failed,
    ReadyToAttach,
};

enum class StructuralLexicalEventKind
{
    ScopeEntered,
    ScopeExited,
    StatementCompleted,
    HardViolation,
};

struct StructuralLexicalEvent
{
    StructuralLexicalEventKind kind = StructuralLexicalEventKind::StatementCompleted;
    std::string token;
    size_t line_number = 0;
};

struct StructuralClassVerifierState
{
    StructuralVerificationStatus status = StructuralVerificationStatus::Idle;
    std::string class_name;
    std::string strategy_name;
    std::vector<std::string> expected_keywords;
    std::string failure_reason;
    size_t class_name_hash = 0;
    size_t class_scope_depth = 0;
    size_t line_started = 0;
    bool saw_class_scope = false;
};

struct StructuralAnalysisState
{
    std::vector<CrucialClassInfo> crucial_classes;
    StructuralClassVerifierState current_class;
};

// Scaffold: interval diffing must reuse lexical structural analysis
// instead of introducing a second scanner. These structs describe a
// changed source region and the structural signals the verifier emits
// when asked to re-scan that region.
struct LexicalIntervalRefreshInput
{
    std::string file_path;
    std::string source;
    size_t start_line = 0;
    size_t end_line = 0;
    std::string source_pattern;
};

struct LexicalIntervalRefreshOutput
{
    bool refreshed = false;
    bool class_boundary_seen = false;
    bool hard_violation_seen = false;
    std::string affected_class_name;
    std::vector<StructuralLexicalEvent> structure_events;
    std::vector<std::string> notes;
};

/**
 * Hook for modular structural-analysis logic when a class/struct declaration is seen
 * during lexical parsing.
 */
void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context,
    StructuralAnalysisState& state);

void reset_structural_analysis_state(StructuralAnalysisState& state);
bool is_crucial_class_name(
    const StructuralAnalysisState& state,
    const std::string& class_name,
    size_t* out_class_name_hash = nullptr);
const std::vector<CrucialClassInfo>& get_crucial_class_registry(const StructuralAnalysisState& state);
void record_structural_lexical_event(const StructuralLexicalEvent& event, StructuralAnalysisState& state);
bool should_keep_virtual_broken_branch(const StructuralAnalysisState& state);
bool current_structural_candidate_ready_to_attach(const StructuralAnalysisState& state);
bool current_structural_candidate_failed(const StructuralAnalysisState& state);
void clear_current_structural_candidate(StructuralAnalysisState& state);
const StructuralClassVerifierState* current_structural_candidate(const StructuralAnalysisState& state);

// Scaffold class-candidate lifecycle helpers. The build loop drives these
// as it crosses class boundaries so the verifier state stays class-local
// and the detached virtual-broken branch can attach or discard safely.
void begin_class_candidate(
    const std::string& class_name,
    const std::string& strategy_name,
    const std::vector<std::string>& expected_keywords,
    size_t line_started,
    StructuralAnalysisState& state);
void mark_class_candidate_failed(
    const std::string& reason,
    StructuralAnalysisState& state);
void mark_class_candidate_ready_to_attach(StructuralAnalysisState& state);

// Scaffold: interval refresh entrypoint. Re-runs lexical structural
// analysis for a changed source region and reports the structural
// signals needed by the diffing locator.
//
// TODO: replace stub emission with a real slice of the existing scanner
// once the lexical verifier is fully extracted from the build loop.
LexicalIntervalRefreshOutput refresh_lexical_structure_for_interval(
    const LexicalIntervalRefreshInput& input,
    StructuralAnalysisState& state);

#endif // LEXICAL_STRUCTURE_HOOKS_HPP
