#ifndef LANGUAGE_TOKENS_HPP
#define LANGUAGE_TOKENS_HPP

#include <string>
#include <unordered_set>

enum class LanguageId
{
    Cpp
};

struct LanguageTokenConfig
{
    // Parse tree node labels
    std::string node_translation_unit;
    std::string node_block;
    std::string node_statement;
    std::string node_return_statement;
    std::string node_class_decl;
    std::string node_struct_decl;
    std::string node_namespace_decl;
    std::string node_conditional_statement;
    std::string node_loop_statement;
    std::string node_assignment_or_decl;
    std::string node_member_assignment;

    // Punctuation tokens
    std::string token_open_brace;
    std::string token_close_brace;
    std::string token_statement_end;
    std::string token_assignment;
    std::string token_scope_operator;
    std::string token_member_arrow;

    // Keyword groups
    std::unordered_set<std::string> class_keywords;
    std::unordered_set<std::string> conditional_keywords;
    std::unordered_set<std::string> loop_keywords;
    std::unordered_set<std::string> function_exclusion_keywords;
    std::unordered_set<std::string> primitive_type_keywords;
    std::unordered_set<std::string> allocator_keywords;
    std::unordered_set<std::string> allocator_template_functions;
};

const LanguageTokenConfig& language_tokens(LanguageId language_id);
std::string lowercase_ascii(const std::string& input);

#endif // LANGUAGE_TOKENS_HPP
