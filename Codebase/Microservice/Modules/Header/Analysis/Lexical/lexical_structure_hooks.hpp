#pragma once

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode;
struct AnalysisContext;

struct CrucialClassInfo
{
    std::string          name;
    std::size_t          hash = 0;
    const ParseTreeNode* node = nullptr;
};

struct StructuralAnalysisState
{
    std::vector<CrucialClassInfo> crucial_classes;
    std::size_t                   classes_scanned = 0;
};

void on_class_scanned_structural_hook(
    const ParseTreeNode&     class_node,
    StructuralAnalysisState& state,
    AnalysisContext&         context);

void reset_structural_analysis_state(StructuralAnalysisState& state);

bool is_crucial_class_name(const std::string& name);

const std::vector<CrucialClassInfo>& get_crucial_class_registry(
    const StructuralAnalysisState& state);
