#include "Analysis/Lexical/lexical_structure_hooks.hpp"

void on_class_scanned_structural_hook(const ParseTreeNode&, StructuralAnalysisState&, AnalysisContext&)
{
}

void reset_structural_analysis_state(StructuralAnalysisState& state)
{
    state.crucial_classes.clear();
    state.classes_scanned = 0;
}

bool is_crucial_class_name(const std::string&)
{
    return false;
}

const std::vector<CrucialClassInfo>& get_crucial_class_registry(const StructuralAnalysisState& state)
{
    return state.crucial_classes;
}
