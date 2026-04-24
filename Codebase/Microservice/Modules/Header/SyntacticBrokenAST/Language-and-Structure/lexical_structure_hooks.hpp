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

#endif // LEXICAL_STRUCTURE_HOOKS_HPP
