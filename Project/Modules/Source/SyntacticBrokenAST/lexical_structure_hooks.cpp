#include "lexical_structure_hooks.hpp"

#include <string>
#include <vector>

void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context)
{
    (void)class_name;
    (void)declaration_tokens;
    (void)context;
    // Intentionally no-op scaffold for modular structural analyzers.
}
