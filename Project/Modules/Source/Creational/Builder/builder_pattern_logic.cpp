#include "Builder/builder_pattern_logic.hpp"

#include "language_tokens.hpp"

#include <cctype>
#include <string>
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
    for (const ParseTreeNode& n : fn.children)
    {
        if (n.kind == "AssignmentOrVarDecl" || n.kind == "MemberAssignment")
        {
            return true;
        }
    }
    return false;
}
} // namespace

CreationalTreeNode build_builder_pattern_tree(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{"BuilderPatternRoot", "class with multiple assignment-oriented methods", {}};

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            CreationalTreeNode cls{"ClassNode", class_name(node->value), {}};

            int qualifying_fn_count = 0;
            for (const ParseTreeNode& fn : node->children)
            {
                if (!is_function_block(fn))
                {
                    continue;
                }
                if (!has_builder_assignments(fn))
                {
                    continue;
                }

                ++qualifying_fn_count;
                cls.children.push_back(CreationalTreeNode{"BuilderMethod", function_name(fn.value), {}});
            }

            if (qualifying_fn_count >= 2)
            {
                root.children.push_back(std::move(cls));
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return root;
}
