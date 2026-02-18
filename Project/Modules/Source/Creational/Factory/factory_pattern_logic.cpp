#include "Factory/factory_pattern_logic.hpp"

#include "language_tokens.hpp"
#include "parse_tree_symbols.hpp"

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

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
}

std::string class_name_from_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        if (cfg.class_keywords.find(to_lower(words[i])) != cfg.class_keywords.end())
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

bool is_conditional_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = to_lower(trim(node.value));
    return starts_with(lowered, "if") || starts_with(lowered, "else if") || starts_with(lowered, "switch");
}

std::string extract_return_expr(const std::string& value)
{
    std::string expr = trim(value);
    const std::string lowered = to_lower(expr);
    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
    }
    return expr;
}

std::string extract_type_in_angle_brackets(const std::string& expr)
{
    const size_t l = expr.find('<');
    const size_t r = expr.find('>', l == std::string::npos ? 0 : l + 1);
    if (l == std::string::npos || r == std::string::npos || r <= l + 1)
    {
        return {};
    }
    return trim(expr.substr(l + 1, r - l - 1));
}

std::string remove_spaces(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        if (!std::isspace(static_cast<unsigned char>(c)))
        {
            out.push_back(c);
        }
    }
    return out;
}

bool is_factory_allocator_return(const std::string& return_expr, std::string& out_matched_class)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::string lowered = to_lower(trim(return_expr));
    const std::string lowered_no_space = remove_spaces(lowered);

    if (starts_with(lowered, "new "))
    {
        const std::vector<std::string> words = split_words(return_expr.substr(4));
        if (!words.empty() && getClassByName(words.front()) != nullptr)
        {
            out_matched_class = words.front();
            return true;
        }
        return false;
    }

    for (const std::string& allocator : cfg.allocator_template_functions)
    {
        if (lowered_no_space.find(allocator + "<") != std::string::npos)
        {
            const std::string class_candidate = extract_type_in_angle_brackets(return_expr);
            if (!class_candidate.empty() && getClassByName(class_candidate) != nullptr)
            {
                out_matched_class = class_candidate;
                return true;
            }
        }
    }

    return false;
}
} // namespace

CreationalTreeNode build_factory_pattern_tree(const ParseTreeNode& parse_root)
{
    rebuild_parse_tree_symbol_tables(parse_root);

    CreationalTreeNode root{"FactoryPatternRoot", "class/function/conditional/allocator-return", {}};

    std::vector<const ParseTreeNode*> class_blocks;
    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();
        if (is_class_block(*node))
        {
            class_blocks.push_back(node);
        }
        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    for (const ParseTreeNode* cls : class_blocks)
    {
        CreationalTreeNode class_node{"ClassNode", class_name_from_signature(cls->value), {}};

        for (const ParseTreeNode& fn : cls->children)
        {
            if (!is_function_block(fn))
            {
                continue;
            }

            CreationalTreeNode fn_node{"FunctionNode", function_name_from_signature(fn.value), {}};

            for (const ParseTreeNode& cond : fn.children)
            {
                if (!is_conditional_block(cond))
                {
                    continue;
                }

                CreationalTreeNode cond_node{"ConditionalNode", trim(cond.value), {}};

                for (const ParseTreeNode& inner : cond.children)
                {
                    if (inner.kind != "ReturnStatement")
                    {
                        continue;
                    }

                    const std::string expr = extract_return_expr(inner.value);
                    std::string matched_class;
                    if (is_factory_allocator_return(expr, matched_class))
                    {
                        cond_node.children.push_back(
                            CreationalTreeNode{"AllocatorReturn", expr + " | class=" + matched_class, {}});
                    }
                }

                if (!cond_node.children.empty())
                {
                    fn_node.children.push_back(std::move(cond_node));
                }
            }

            if (!fn_node.children.empty())
            {
                class_node.children.push_back(std::move(fn_node));
            }
        }

        if (!class_node.children.empty())
        {
            root.children.push_back(std::move(class_node));
        }
    }

    return root;
}
