#include "lexical_structure_hooks.hpp"

#include "language_tokens.hpp"

#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace
{
class IStructuralAnalyzer
{
public:
    virtual ~IStructuralAnalyzer() = default;
    virtual const char* strategy_name() const = 0;
    virtual bool is_crucial_class(
        const std::string& class_name,
        const std::vector<std::string>& declaration_tokens) const = 0;
};

class KeywordAnalyzer final : public IStructuralAnalyzer
{
public:
    KeywordAnalyzer(std::string name, std::vector<std::string> keywords)
        : strategy_name_(std::move(name)), keywords_(std::move(keywords))
    {
    }

    const char* strategy_name() const override
    {
        return strategy_name_.c_str();
    }

    bool is_crucial_class(
        const std::string& class_name,
        const std::vector<std::string>& declaration_tokens) const override
    {
        const std::string lowered_name = lowercase_ascii(class_name);
        for (const std::string& keyword : keywords_)
        {
            if (lowered_name.find(keyword) != std::string::npos)
            {
                return true;
            }
        }

        for (const std::string& token : declaration_tokens)
        {
            const std::string lowered_token = lowercase_ascii(token);
            for (const std::string& keyword : keywords_)
            {
                if (lowered_token.find(keyword) != std::string::npos)
                {
                    return true;
                }
            }
        }

        return false;
    }

private:
    std::string strategy_name_;
    std::vector<std::string> keywords_;
};

const IStructuralAnalyzer& select_analyzer(const std::string& source_pattern)
{
    static const KeywordAnalyzer factory_analyzer(
        "FactoryStructuralStrategy",
        {"factory", "creator", "create"});
    static const KeywordAnalyzer singleton_analyzer(
        "SingletonStructuralStrategy",
        {"singleton", "instance", "config"});
    static const KeywordAnalyzer builder_analyzer(
        "BuilderStructuralStrategy",
        {"builder", "build", "director"});
    static const KeywordAnalyzer strategy_analyzer(
        "StrategyStructuralStrategy",
        {"strategy", "context"});
    static const KeywordAnalyzer observer_analyzer(
        "ObserverStructuralStrategy",
        {"observer", "subject", "listener"});
    static const KeywordAnalyzer null_analyzer(
        "NullStructuralStrategy",
        {});

    const std::string pattern = lowercase_ascii(source_pattern);
    if (pattern == "factory")
    {
        return factory_analyzer;
    }
    if (pattern == "singleton")
    {
        return singleton_analyzer;
    }
    if (pattern == "builder")
    {
        return builder_analyzer;
    }
    if (pattern == "strategy")
    {
        return strategy_analyzer;
    }
    if (pattern == "observer")
    {
        return observer_analyzer;
    }

    return null_analyzer;
}

std::unordered_map<std::string, size_t> g_crucial_class_hash_by_name;
std::vector<CrucialClassInfo> g_crucial_class_registry;
} // namespace

void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context)
{
    const IStructuralAnalyzer& analyzer = select_analyzer(context.source_pattern);
    if (!analyzer.is_crucial_class(class_name, declaration_tokens))
    {
        return;
    }

    if (g_crucial_class_hash_by_name.find(class_name) != g_crucial_class_hash_by_name.end())
    {
        return;
    }

    const size_t class_name_hash = std::hash<std::string>{}(class_name);
    g_crucial_class_hash_by_name[class_name] = class_name_hash;

    CrucialClassInfo info;
    info.name = class_name;
    info.class_name_hash = class_name_hash;
    info.strategy_name = analyzer.strategy_name();
    g_crucial_class_registry.push_back(std::move(info));
}

void reset_structural_analysis_state()
{
    g_crucial_class_hash_by_name.clear();
    g_crucial_class_registry.clear();
}

bool is_crucial_class_name(const std::string& class_name, size_t* out_class_name_hash)
{
    const auto it = g_crucial_class_hash_by_name.find(class_name);
    if (it == g_crucial_class_hash_by_name.end())
    {
        return false;
    }

    if (out_class_name_hash != nullptr)
    {
        *out_class_name_hash = it->second;
    }
    return true;
}

const std::vector<CrucialClassInfo>& get_crucial_class_registry()
{
    return g_crucial_class_registry;
}
