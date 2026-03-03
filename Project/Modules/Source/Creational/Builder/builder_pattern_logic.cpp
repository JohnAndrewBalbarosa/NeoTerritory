#include "Builder/builder_pattern_logic.hpp"

#include "language_tokens.hpp"

#include <cctype>
#include <string>
#include <utility>
#include <vector>

namespace
{
std::string trim(const std::string& input)
{
    size_t begin = 0;
    while (begin < input.size() && std::isspace(static_cast<unsigned char>(input[begin])))
    {
        ++begin;
    }

    size_t end = input.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }

    return input.substr(begin, end - begin);
}

std::vector<std::string> split_words(const std::string& text)
{
    std::vector<std::string> words;
    std::string current;
    for (char c : text)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
        }
        else if (!current.empty())
        {
            words.push_back(current);
            current.clear();
        }
    }
    if (!current.empty())
    {
        words.push_back(current);
    }
    return words;
}

std::string lower(const std::string& s)
{
    return lowercase_ascii(s);
}

bool starts_with(const std::string& s, const std::string& p)
{
    return s.size() >= p.size() && s.compare(0, p.size(), p) == 0;
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }
    const std::string v = lower(trim(node.value));
    return starts_with(v, "class ") || starts_with(v, "struct ");
}

bool is_function_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string sig = trim(node.value);
    if (sig.empty() || sig.find('(') == std::string::npos || sig.find(')') == std::string::npos)
    {
        return false;
    }

    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(sig);
    if (words.empty())
    {
        return false;
    }
    return cfg.function_exclusion_keywords.find(lower(words.front())) == cfg.function_exclusion_keywords.end();
}

std::string class_name(const std::string& sig)
{
    const std::vector<std::string> words = split_words(sig);
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

std::string function_name(const std::string& sig)
{
    const std::string t = trim(sig);
    const size_t open = t.find('(');
    if (open == std::string::npos)
    {
        return {};
    }
    const std::vector<std::string> words = split_words(t.substr(0, open));
    if (words.empty())
    {
        return {};
    }
    return words.back();
}

bool has_builder_assignments(const ParseTreeNode& fn)
{
    std::vector<const ParseTreeNode*> stack{&fn};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (node->kind == "AssignmentOrVarDecl" || node->kind == "MemberAssignment")
        {
            return true;
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return false;
}

bool returns_self_type(const std::string& signature, const std::string& class_name_value)
{
    if (class_name_value.empty())
    {
        return false;
    }

    const std::string t = trim(signature);
    const size_t open = t.find('(');
    if (open == std::string::npos)
    {
        return false;
    }

    const std::vector<std::string> words = split_words(t.substr(0, open));
    if (words.size() < 2)
    {
        return false;
    }

    return words[words.size() - 2] == class_name_value;
}

bool is_build_step_method(const std::string& fn_name)
{
    const std::string lowered = lower(fn_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult" ||
           starts_with(lowered, "build");
}
} // namespace

std::vector<BuilderStructureCheckResult> check_builder_pattern_structure(const ParseTreeNode& parse_root)
{
    std::vector<BuilderStructureCheckResult> results;

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            BuilderStructureCheckResult check;
            check.class_name = class_name(node->value);
            if (check.class_name.empty())
            {
                continue;
            }

            for (const ParseTreeNode& fn : node->children)
            {
                if (!is_function_block(fn))
                {
                    continue;
                }

                BuilderMethodStructureCheck method;
                method.method_name = function_name(fn.value);
                method.mutates_state = has_builder_assignments(fn);
                method.returns_self_type = returns_self_type(fn.value, check.class_name);
                method.build_step = is_build_step_method(method.method_name);

                if (method.mutates_state && method.returns_self_type)
                {
                    ++check.mutating_chainable_method_count;
                }
                check.has_build_step = check.has_build_step || method.build_step;
                check.methods.push_back(std::move(method));
            }

            if (!check.methods.empty())
            {
                check.conforms =
                    check.mutating_chainable_method_count >= 2 &&
                    check.has_build_step;
                results.push_back(std::move(check));
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return results;
}

CreationalTreeNode build_builder_pattern_tree(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{
        "BuilderPatternRoot",
        ">=2 mutating self-return methods + >=1 build step",
        {}};

    const std::vector<BuilderStructureCheckResult> checks = check_builder_pattern_structure(parse_root);
    for (const BuilderStructureCheckResult& check : checks)
    {
        if (!check.conforms)
        {
            continue;
        }

        CreationalTreeNode cls{
            "ClassNode",
            check.class_name +
                " | mutating_chainable=" + std::to_string(check.mutating_chainable_method_count) +
                " | has_build_step=" + (check.has_build_step ? "true" : "false"),
            {}};

        for (const BuilderMethodStructureCheck& method : check.methods)
        {
            if (method.build_step)
            {
                cls.children.push_back(
                    CreationalTreeNode{"BuildStepMethod", method.method_name, {}});
                continue;
            }

            if (method.mutates_state && method.returns_self_type)
            {
                cls.children.push_back(
                    CreationalTreeNode{"BuilderMethod", method.method_name, {}});
            }
        }

        root.children.push_back(std::move(cls));
    }

    return root;
}
