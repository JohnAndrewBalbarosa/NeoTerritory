#ifndef BEHAVIOURAL_STRUCTURAL_HOOKS_HPP
#define BEHAVIOURAL_STRUCTURAL_HOOKS_HPP

#include <string>
#include <vector>

bool resolve_behavioural_structural_keywords(
    const std::string& source_pattern,
    std::string& out_strategy_name,
    std::vector<std::string>& out_keywords);

#endif // BEHAVIOURAL_STRUCTURAL_HOOKS_HPP
