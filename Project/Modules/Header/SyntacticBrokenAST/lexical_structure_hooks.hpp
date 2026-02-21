#ifndef LEXICAL_STRUCTURE_HOOKS_HPP
#define LEXICAL_STRUCTURE_HOOKS_HPP

#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct CrucialClassInfo
{
    std::string name;
    size_t class_name_hash;
    std::string strategy_name;
};

/**
 * Hook for modular structural-analysis logic when a class/struct declaration is seen
 * during lexical parsing.
 */
void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context);

void reset_structural_analysis_state();
bool is_crucial_class_name(const std::string& class_name, size_t* out_class_name_hash = nullptr);
const std::vector<CrucialClassInfo>& get_crucial_class_registry();

#endif // LEXICAL_STRUCTURE_HOOKS_HPP
