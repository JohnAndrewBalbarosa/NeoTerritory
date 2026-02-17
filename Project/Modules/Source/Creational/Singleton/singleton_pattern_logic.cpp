#include "Singleton/singleton_pattern_logic.hpp"

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

std::string to_lower(const std::string& value)
{
    return lowercase_ascii(value);
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
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

std::string class_name_from_signature(const std::string& signature)
{
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = to_lower(words[i]);
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

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = to_lower(trim(node.value));
    return starts_with(lowered, "class ") || starts_with(lowered, "struct ");
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

    const std::string first = to_lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

std::string extract_return_identifier(const ParseTreeNode& node)
{
    if (node.kind != "ReturnStatement")
    {
        return {};
    }

    std::string expr = trim(node.value);
    const std::string lowered = to_lower(expr);
    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
    }

    const std::vector<std::string> words = split_words(expr);
    if (words.empty())
    {
        return {};
    }

    return words.front();
}

bool find_static_same_class_identifier(const ParseTreeNode& fn_node, const std::string& class_name, std::string& out_identifier)
{
    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (node->kind == "Statement" || node->kind == "AssignmentOrVarDecl")
        {
            const std::vector<std::string> words = split_words(node->value);
            for (size_t i = 0; i + 2 < words.size(); ++i)
            {
                if (to_lower(words[i]) == "static" && words[i + 1] == class_name)
                {
                    out_identifier = words[i + 2];
                    return true;
                }
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return false;
}

bool function_returns_identifier(const ParseTreeNode& fn_node, const std::string& identifier)
{
    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        const std::string ret_id = extract_return_identifier(*node);
        if (!ret_id.empty() && ret_id == identifier)
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
} // namespace

CreationalTreeNode build_singleton_pattern_tree(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{"SingletonPatternRoot", "static same-class instance + return identifier", {}};

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            const std::string cls_name = class_name_from_signature(node->value);
            if (cls_name.empty())
            {
                continue;
            }

            CreationalTreeNode cls_node{"ClassNode", cls_name, {}};

            for (const ParseTreeNode& fn : node->children)
            {
                if (!is_function_block(fn))
                {
                    continue;
                }

                std::string static_identifier;
                if (!find_static_same_class_identifier(fn, cls_name, static_identifier))
                {
                    continue;
                }

                if (!function_returns_identifier(fn, static_identifier))
                {
                    continue;
                }

                CreationalTreeNode fn_node{"SingletonFunction", function_name_from_signature(fn.value), {}};
                fn_node.children.push_back(CreationalTreeNode{
                    "StaticInstanceDecl",
                    "static " + cls_name + " " + static_identifier,
                    {}});
                fn_node.children.push_back(CreationalTreeNode{
                    "ReturnIdentifier",
                    static_identifier,
                    {}});

                cls_node.children.push_back(std::move(fn_node));
            }

            if (!cls_node.children.empty())
            {
                root.children.push_back(std::move(cls_node));
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return root;
}
