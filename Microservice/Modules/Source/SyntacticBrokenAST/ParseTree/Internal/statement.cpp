#include "Internal/parse_tree_internal.hpp"

#include "language_tokens.hpp"

#include <string>
#include <vector>

namespace parse_tree_internal
{
namespace
{
bool is_type_keyword(const std::string& token)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    return cfg.primitive_type_keywords.find(token) != cfg.primitive_type_keywords.end();
}
} // namespace

std::string detect_statement_kind(const std::vector<std::string>& statement_tokens)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (statement_tokens.empty())
    {
        return cfg.node_statement;
    }

    const std::string& first_token = statement_tokens.front();
    if (cfg.conditional_keywords.find(first_token) != cfg.conditional_keywords.end())
    {
        return cfg.node_conditional_statement;
    }
    if (cfg.loop_keywords.find(first_token) != cfg.loop_keywords.end())
    {
        return cfg.node_loop_statement;
    }
    if (first_token == "return")
    {
        return cfg.node_return_statement;
    }
    if (first_token == "class")
    {
        return cfg.node_class_decl;
    }
    if (first_token == "struct")
    {
        return cfg.node_struct_decl;
    }
    if (first_token == "namespace")
    {
        return cfg.node_namespace_decl;
    }

    bool has_assignment = false;
    bool has_member_arrow = false;
    for (const std::string& token : statement_tokens)
    {
        if (token == cfg.token_assignment)
        {
            has_assignment = true;
        }
        if (token == cfg.token_member_arrow)
        {
            has_member_arrow = true;
        }
    }

    if (has_assignment && has_member_arrow)
    {
        return cfg.node_member_assignment;
    }

    if (has_assignment || is_type_keyword(first_token))
    {
        return cfg.node_assignment_or_decl;
    }

    return cfg.node_statement;
}

bool is_class_or_struct_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = tokenize_text(signature);
    if (words.size() < 2)
    {
        return false;
    }

    return cfg.class_keywords.find(lowercase_ascii(words.front())) != cfg.class_keywords.end();
}

bool is_function_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = tokenize_text(signature);
    if (words.empty())
    {
        return false;
    }

    bool has_open_paren = false;
    bool has_close_paren = false;
    for (const std::string& token : words)
    {
        if (token == "(")
        {
            has_open_paren = true;
        }
        else if (token == ")")
        {
            has_close_paren = true;
        }
    }

    if (!has_open_paren || !has_close_paren)
    {
        return false;
    }

    const std::string first = lowercase_ascii(words.front());
    if (cfg.function_exclusion_keywords.find(first) != cfg.function_exclusion_keywords.end())
    {
        return false;
    }

    if (is_class_or_struct_signature(signature))
    {
        return false;
    }

    return true;
}

bool is_class_declaration_node(const ParseTreeNode& node)
{
    if (node.kind == "ClassDecl" || node.kind == "StructDecl")
    {
        return true;
    }

    return node.kind == "Block" && is_class_or_struct_signature(node.value);
}

bool is_global_function_declaration_node(const ParseTreeNode& node)
{
    return node.kind == "Block" && is_function_signature(node.value);
}
} // namespace parse_tree_internal
