#ifndef LEXICAL_STRUCTURE_HOOKS_HPP
#define LEXICAL_STRUCTURE_HOOKS_HPP

#include "analysis_context.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct CrucialClassInfo
{
    std::string name;
    size_t class_name_hash;
    std::string strategy_name;
};

struct StructuralAnalysisState
{
    std::vector<CrucialClassInfo> crucial_classes;
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

#endif // LEXICAL_STRUCTURE_HOOKS_HPP
