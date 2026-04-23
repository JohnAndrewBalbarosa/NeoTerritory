#include "Logic/behavioural_structural_hooks.hpp"

#include <cctype>
#include <string>
#include <vector>

namespace
{
std::string lower_ascii(const std::string& input)
{
    std::string out = input;
    for (char& c : out)
    {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return out;
}
} // namespace

bool resolve_behavioural_structural_keywords(
    const std::string& source_pattern,
    std::string& out_strategy_name,
    std::vector<std::string>& out_keywords)
{
    const std::string pattern = lower_ascii(source_pattern);
    if (pattern == "strategy")
    {
        out_strategy_name = "StrategyStructuralStrategy";
        out_keywords = {"strategy", "context"};
        return true;
    }
    if (pattern == "observer")
    {
        out_strategy_name = "ObserverStructuralStrategy";
        out_keywords = {"observer", "subject", "listener"};
        return true;
    }

    return false;
}
