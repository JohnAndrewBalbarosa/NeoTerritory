#include "Factory/factory_pattern_logic.hpp"

#include "Language-and-Structure/language_tokens.hpp"
#include "parse_tree_symbols.hpp"

#include <cctype>
#include <string>
#include <unordered_map>
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
    return starts_with(lowered, "if") ||
           starts_with(lowered, "else if") ||
           starts_with(lowered, "else") ||
           starts_with(lowered, "switch");
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

bool is_identifier_token(const std::string& token)
{
    if (token.empty())
    {
        return false;
    }

    const char first = token.front();
    if (!(std::isalpha(static_cast<unsigned char>(first)) || first == '_'))
    {
        return false;
    }

    for (char c : token)
    {
        if (!(std::isalnum(static_cast<unsigned char>(c)) || c == '_'))
        {
            return false;
        }
    }

    return true;
}

bool contains_factory_hint(const std::string& name)
{
    const std::string lowered = to_lower(name);
    return lowered.find("factory") != std::string::npos ||
           lowered.find("creator") != std::string::npos ||
           lowered.find("create") != std::string::npos ||
           lowered.find("make") != std::string::npos ||
           lowered.find("build") != std::string::npos;
}

bool is_factory_allocator_return(
    const ParseTreeSymbolTables& tables,
    const std::string& return_expr,
    std::string& out_matched_class)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::string lowered = to_lower(trim(return_expr));
    const std::string lowered_no_space = remove_spaces(lowered);

    if (starts_with(lowered, "new "))
    {
        const std::vector<std::string> words = split_words(return_expr.substr(4));
        if (!words.empty() && find_class_by_name(tables, words.front()) != nullptr)
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
            if (!class_candidate.empty() && find_class_by_name(tables, class_candidate) != nullptr)
            {
                out_matched_class = class_candidate;
                return true;
            }
        }
    }

    return false;
}

bool function_contains_allocator_return(
    const ParseTreeNode& fn_node,
    const ParseTreeSymbolTables& tables)
{
    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (node->kind == "ReturnStatement")
        {
            const std::string expr = extract_return_expr(node->value);
            std::string matched_class;
            if (is_factory_allocator_return(tables, expr, matched_class))
            {
                return true;
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return false;
}

std::string function_return_class_name(
    const ParseTreeSymbolTables& tables,
    const std::string& signature)
{
    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::vector<std::string> words = split_words(trimmed.substr(0, open));
    if (words.size() < 2)
    {
        return {};
    }

    for (size_t i = words.size() - 1; i-- > 0;)
    {
        if (find_class_by_name(tables, words[i]) != nullptr)
        {
            return words[i];
        }
    }

    return {};
}

std::unordered_map<std::string, std::string> collect_local_object_variables(
    const ParseTreeNode& fn_node,
    const ParseTreeSymbolTables& tables)
{
    std::unordered_map<std::string, std::string> out;

    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (node->kind != "ReturnStatement")
        {
            const std::vector<std::string> words = split_words(node->value);
            for (size_t i = 0; i + 1 < words.size(); ++i)
            {
                const std::string& class_candidate = words[i];
                const std::string& variable_candidate = words[i + 1];

                if (find_class_by_name(tables, class_candidate) == nullptr)
                {
                    continue;
                }
                if (!is_identifier_token(variable_candidate))
                {
                    continue;
                }

                out[variable_candidate] = class_candidate;
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return out;
}

bool is_factory_object_return(
    const ParseTreeSymbolTables& tables,
    const std::string& return_expr,
    bool allow_object_return,
    const std::string& function_return_class,
    const std::unordered_map<std::string, std::string>& local_object_variables,
    std::string& out_matched_class)
{
    if (!allow_object_return)
    {
        return false;
    }

    const std::string expr = trim(return_expr);
    if (expr.empty())
    {
        return false;
    }

    if (expr.front() == '{' && !function_return_class.empty())
    {
        out_matched_class = function_return_class;
        return true;
    }

    const std::vector<std::string> words = split_words(expr);
    if (words.empty())
    {
        return false;
    }

    if (find_class_by_name(tables, words.front()) != nullptr)
    {
        out_matched_class = words.front();
        return true;
    }

    const auto direct_identifier_hit = local_object_variables.find(words.front());
    if (words.size() == 1 && direct_identifier_hit != local_object_variables.end())
    {
        out_matched_class = direct_identifier_hit->second;
        return true;
    }

    const auto wrapped_identifier_hit = local_object_variables.find(words.back());
    if (wrapped_identifier_hit != local_object_variables.end())
    {
        out_matched_class = wrapped_identifier_hit->second;
        return true;
    }

    return false;
}

bool append_factory_return_if_matched(
    const ParseTreeNode& node,
    const ParseTreeSymbolTables& tables,
    bool allow_object_return,
    const std::string& function_return_class,
    const std::unordered_map<std::string, std::string>& local_object_variables,
    std::vector<CreationalTreeNode>& out_children)
{
    if (node.kind != "ReturnStatement")
    {
        return false;
    }

    const std::string expr = extract_return_expr(node.value);
    std::string matched_class;
    if (is_factory_allocator_return(tables, expr, matched_class))
    {
        out_children.push_back(CreationalTreeNode{"AllocatorReturn", expr + " | class=" + matched_class, {}});
        return true;
    }

    if (is_factory_object_return(
            tables,
            expr,
            allow_object_return,
            function_return_class,
            local_object_variables,
            matched_class))
    {
        out_children.push_back(CreationalTreeNode{"ObjectReturn", expr + " | class=" + matched_class, {}});
        return true;
    }

    return false;
}

void collect_factory_returns_in_subtree(
    const ParseTreeNode& root,
    const ParseTreeSymbolTables& tables,
    bool allow_object_return,
    const std::string& function_return_class,
    const std::unordered_map<std::string, std::string>& local_object_variables,
    std::vector<CreationalTreeNode>& out_children)
{
    std::vector<const ParseTreeNode*> stack{&root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        append_factory_return_if_matched(
            *node,
            tables,
            allow_object_return,
            function_return_class,
            local_object_variables,
            out_children);

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }
}

class FactoryPatternAlgorithm final : public ICreationalPatternAlgorithm
{
public:
    std::string pattern_root_kind() const override
    {
        return "FactoryPatternRoot";
    }

    std::string pattern_root_label() const override
    {
        return "class/function/conditional-or-fallthrough/allocator-or-object-return";
    }

    bool inspect_registered_class(
        const CreationalRegisteredClass& registered_class,
        const ParseTreeSymbolTables& tables,
        CreationalTreeNode& out_class_node) const override
    {
        if (registered_class.node == nullptr)
        {
            return false;
        }

        CreationalTreeNode class_node{"ClassNode", registered_class.name, {}};

        for (const ParseTreeNode& fn : registered_class.node->children)
        {
            if (!is_function_block(fn))
            {
                continue;
            }

            const std::string function_name = function_name_from_signature(fn.value);
            CreationalTreeNode fn_node{"FunctionNode", function_name, {}};
            const std::string function_return_class = function_return_class_name(tables, fn.value);
            const std::unordered_map<std::string, std::string> local_object_variables =
                collect_local_object_variables(fn, tables);
            const bool allow_object_return =
                contains_factory_hint(class_node.label) ||
                contains_factory_hint(function_name) ||
                function_contains_allocator_return(fn, tables);

            for (const ParseTreeNode& cond : fn.children)
            {
                if (!is_conditional_block(cond))
                {
                    continue;
                }

                CreationalTreeNode cond_node{"ConditionalNode", trim(cond.value), {}};
                collect_factory_returns_in_subtree(
                    cond,
                    tables,
                    allow_object_return,
                    function_return_class,
                    local_object_variables,
                    cond_node.children);

                if (!cond_node.children.empty())
                {
                    fn_node.children.push_back(std::move(cond_node));
                }
            }

            CreationalTreeNode fallthrough_node{"ConditionalNode", "fallthrough-return", {}};
            for (const ParseTreeNode& child : fn.children)
            {
                if (is_conditional_block(child))
                {
                    continue;
                }
                append_factory_return_if_matched(
                    child,
                    tables,
                    allow_object_return,
                    function_return_class,
                    local_object_variables,
                    fallthrough_node.children);
            }

            if (!fallthrough_node.children.empty())
            {
                fn_node.children.push_back(std::move(fallthrough_node));
            }

            if (!fn_node.children.empty())
            {
                class_node.children.push_back(std::move(fn_node));
            }
        }

        if (class_node.children.empty())
        {
            return false;
        }

        out_class_node = std::move(class_node);
        return true;
    }
};
} // namespace

CreationalTreeNode build_factory_pattern_tree(const ParseTreeNode& parse_root)
{
    return build_creational_pattern_tree_with_mediator(parse_root, factory_pattern_algorithm());
}

const ICreationalPatternAlgorithm& factory_pattern_algorithm()
{
    static const FactoryPatternAlgorithm algorithm;
    return algorithm;
}
