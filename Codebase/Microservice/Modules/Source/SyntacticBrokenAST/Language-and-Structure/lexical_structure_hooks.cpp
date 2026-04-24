#include "Language-and-Structure/lexical_structure_hooks.hpp"

#include "Logic/behavioural_structural_hooks.hpp"
#include "Logic/creational_structural_hooks.hpp"
#include "Language-and-Structure/language_tokens.hpp"

#include <functional>
#include <string>
#include <utility>
#include <vector>

namespace
{
void seed_current_structural_candidate(
    const std::string& class_name,
    const std::string& strategy_name,
    const std::vector<std::string>& keywords,
    StructuralAnalysisState& state)
{
    StructuralClassVerifierState current;
    current.status = StructuralVerificationStatus::Tracking;
    current.class_name = class_name;
    current.strategy_name = strategy_name;
    current.expected_keywords = keywords;
    current.class_name_hash = std::hash<std::string>{}(class_name);
    state.current_class = std::move(current);
}

bool contains_class(const StructuralAnalysisState& state, const std::string& class_name)
{
    for (const CrucialClassInfo& info : state.crucial_classes)
    {
        if (info.name == class_name)
        {
            return true;
        }
    }
    return false;
}

bool token_matches_any_keyword(const std::string& token, const std::vector<std::string>& keywords)
{
    const std::string lowered = lowercase_ascii(token);
    for (const std::string& keyword : keywords)
    {
        if (lowered.find(keyword) != std::string::npos)
        {
            return true;
        }
    }
    return false;
}

bool is_keyword_hit(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const std::vector<std::string>& keywords)
{
    if (keywords.empty())
    {
        return false;
    }

    if (token_matches_any_keyword(class_name, keywords))
    {
        return true;
    }

    for (const std::string& $1***REDACTED***$2)
    {
        if (token_matches_any_keyword(token, keywords))
        {
            return true;
        }
    }

    return false;
}

bool select_structural_keywords(
    const std::string& source_pattern,
    std::string& out_strategy_name,
    std::vector<std::string>& out_keywords)
{
    out_strategy_name.clear();
    out_keywords.clear();

    if (resolve_creational_structural_keywords(source_pattern, out_strategy_name, out_keywords))
    {
        return true;
    }

    if (resolve_behavioural_structural_keywords(source_pattern, out_strategy_name, out_keywords))
    {
        return true;
    }

    return false;
}
} // namespace

void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context,
    StructuralAnalysisState& state)
{
    std::string strategy_name;
    std::vector<std::string> keywords;
    if (!select_structural_keywords(context.source_pattern, strategy_name, keywords))
    {
        return;
    }

    if (!is_keyword_hit(class_name, declaration_tokens, keywords))
    {
        return;
    }

    if (contains_class(state, class_name))
    {
        return;
    }

    const size_t class_name_hash = std::hash<std::string>{}(class_name);
    seed_current_structural_candidate(class_name, strategy_name, keywords, state);

    CrucialClassInfo info;
    info.name = class_name;
    info.class_name_hash = class_name_hash;
    info.strategy_name = std::move(strategy_name);
    state.crucial_classes.push_back(std::move(info));
}

void reset_structural_analysis_state(StructuralAnalysisState& state)
{
    state.crucial_classes.clear();
    state.current_class = StructuralClassVerifierState{};
}

bool is_crucial_class_name(
    const StructuralAnalysisState& state,
    const std::string& class_name,
    size_t* out_class_name_hash)
{
    for (const CrucialClassInfo& info : state.crucial_classes)
    {
        if (info.name != class_name)
        {
            continue;
        }

        if (out_class_name_hash != nullptr)
        {
            *out_class_name_hash = info.class_name_hash;
        }
        return true;
    }

    return false;
}

const std::vector<CrucialClassInfo>& get_crucial_class_registry(const StructuralAnalysisState& state)
{
    return state.crucial_classes;
}

void record_structural_lexical_event(const StructuralLexicalEvent& event, StructuralAnalysisState& state)
{
    StructuralClassVerifierState& current = state.current_class;
    if (current.status == StructuralVerificationStatus::Idle ||
        current.status == StructuralVerificationStatus::ReadyToAttach)
    {
        return;
    }

    if (current.status == StructuralVerificationStatus::Failed)
    {
        return;
    }

    switch (event.kind)
    {
    case StructuralLexicalEventKind::ScopeEntered:
        ++current.class_scope_depth;
        current.saw_class_scope = true;
        break;
    case StructuralLexicalEventKind::ScopeExited:
        if (current.class_scope_depth > 0)
        {
            --current.class_scope_depth;
        }
        if (current.saw_class_scope && current.class_scope_depth == 0)
        {
            current.status = StructuralVerificationStatus::ReadyToAttach;
        }
        break;
    case StructuralLexicalEventKind::StatementCompleted:
        break;
    case StructuralLexicalEventKind::HardViolation:
        current.status = StructuralVerificationStatus::Failed;
        current.failure_reason = event.token;
        break;
    }
}

bool should_keep_virtual_broken_branch(const StructuralAnalysisState& state)
{
    return state.current_class.status == StructuralVerificationStatus::Tracking;
}

bool current_structural_candidate_ready_to_attach(const StructuralAnalysisState& state)
{
    return state.current_class.status == StructuralVerificationStatus::ReadyToAttach;
}

bool current_structural_candidate_failed(const StructuralAnalysisState& state)
{
    return state.current_class.status == StructuralVerificationStatus::Failed;
}

void clear_current_structural_candidate(StructuralAnalysisState& state)
{
    state.current_class = StructuralClassVerifierState{};
}

const StructuralClassVerifierState* current_structural_candidate(const StructuralAnalysisState& state)
{
    if (state.current_class.status == StructuralVerificationStatus::Idle)
    {
        return nullptr;
    }
    return &state.current_class;
}
