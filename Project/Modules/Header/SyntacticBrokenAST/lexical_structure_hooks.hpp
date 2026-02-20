#ifndef LEXICAL_STRUCTURE_HOOKS_HPP
#define LEXICAL_STRUCTURE_HOOKS_HPP

#include "parse_tree.hpp"

#include <string>
#include <vector>

/**
 * Hook for modular structural-analysis logic when a class/struct declaration is seen
 * during lexical parsing.
 */
void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context);

#endif // LEXICAL_STRUCTURE_HOOKS_HPP
