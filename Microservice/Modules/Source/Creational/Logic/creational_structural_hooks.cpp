#include "Logic/creational_structural_hooks.hpp"

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

bool resolve_creational_structural_keywords(
    const std::string& source_pattern,
    std::string& out_strategy_name,
    std::vector<std::string>& out_keywords)
{
    const std::string pattern = lower_ascii(source_pattern);
    if (pattern == "factory")
    {
        out_strategy_name = "FactoryStructuralStrategy";
        out_keywords = {"factory", "creator", "create"};
        return true;
    }
    if (pattern == "singleton")
    {
        out_strategy_name = "SingletonStructuralStrategy";
        out_keywords = {"singleton", "instance", "config"};
        return true;
    }
    if (pattern == "builder")
    {
        out_strategy_name = "BuilderStructuralStrategy";
        out_keywords = {"builder", "build", "director"};
        return true;
    }

    return false;
}
