#include "Internal/parse_tree_code_generator_internal.hpp"

#include "language_tokens.hpp"

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace parse_tree_codegen_internal
{
bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::vector<std::string> words = split_words(trim(node.value));
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lower(words[i]);
        if (kw == "class" || kw == "struct")
        {
            return true;
        }
    }
    return false;
}

bool is_function_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string signature = trim(node.value);
    if (signature.empty() || signature.find('(') == std::string::npos || signature.find(')') == std::string::npos)
    {
        return false;
    }

    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    if (words.empty())
    {
        return false;
    }

    const std::string first = lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

std::string class_name_from_signature(const std::string& signature)
{
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lower(words[i]);
        if (kw == "class" || kw == "struct")
        {
            return words[i + 1];
        }
    }
    return {};
}

std::string function_name_from_signature(const std::string& signature)
{
    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::vector<std::string> words = split_words(trimmed.substr(0, open));
    if (words.empty())
    {
        return {};
    }

    return words.back();
}

std::vector<std::string> extract_crucial_class_names(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    ParseTreeBuildContext context;
    context.source_pattern = source_pattern;
    context.target_pattern = target_pattern;

    std::vector<SourceFileUnit> files;
    files.push_back(SourceFileUnit{"<memory>", source});

    const ParseTreeBundle bundle = build_cpp_parse_trees(files, context);

    std::vector<std::string> names;
    std::unordered_set<std::string> seen;
    for (const CrucialClassInfo& info : bundle.crucial_classes)
    {
        if (info.name.empty())
        {
            continue;
        }
        if (seen.insert(info.name).second)
        {
            names.push_back(info.name);
        }
    }

    return names;
}

std::unordered_map<std::string, std::string> collect_singleton_strength_by_class(const CreationalTreeNode& singleton_tree)
{
    std::unordered_map<std::string, std::string> out;
    for (const CreationalTreeNode& class_node : singleton_tree.children)
    {
        if (class_node.kind != "ClassNode" || class_node.label.empty())
        {
            continue;
        }

        std::string strength;
        for (const CreationalTreeNode& fn_node : class_node.children)
        {
            if (fn_node.kind != "SingletonFunction")
            {
                continue;
            }

            for (const CreationalTreeNode& detail : fn_node.children)
            {
                if (detail.kind != "SingletonStrength")
                {
                    continue;
                }

                if (detail.label == "strong")
                {
                    strength = "strong";
                    break;
                }
                if (strength.empty() && detail.label == "weak")
                {
                    strength = "weak";
                }
            }

            if (strength == "strong")
            {
                break;
            }
        }

        if (!strength.empty())
        {
            out[class_node.label] = strength;
        }
    }

    return out;
}
} // namespace parse_tree_codegen_internal
