#include "language_tokens.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>

namespace
{
LanguageTokenConfig build_cpp_tokens()
{
    LanguageTokenConfig cfg;

    cfg.node_translation_unit = "TranslationUnit";
    cfg.node_block = "Block";
    cfg.node_statement = "Statement";
    cfg.node_return_statement = "ReturnStatement";
    cfg.node_class_decl = "ClassDecl";
    cfg.node_struct_decl = "StructDecl";
    cfg.node_namespace_decl = "NamespaceDecl";
    cfg.node_conditional_statement = "ConditionalStatement";
    cfg.node_loop_statement = "LoopStatement";
    cfg.node_assignment_or_decl = "AssignmentOrVarDecl";
    cfg.node_member_assignment = "MemberAssignment";

    cfg.token_open_brace = "{";
    cfg.token_close_brace = "}";
    cfg.token_statement_end = ";";
    cfg.token_assignment = "=";
    cfg.token_scope_operator = "::";
    cfg.token_member_arrow = "->";

    cfg.class_keywords = {"class", "struct"};
    cfg.conditional_keywords = {"if", "switch", "else"};
    cfg.loop_keywords = {"for", "while", "do"};
    cfg.function_exclusion_keywords = {
        "if", "else", "switch", "for", "while", "do", "class", "struct"
    };
    cfg.primitive_type_keywords = {
        "auto", "bool", "char", "double", "float", "int", "long", "short",
        "signed", "size_t", "std", "string", "unsigned", "void"
    };
    cfg.allocator_keywords = {"new"};
    cfg.allocator_template_functions = {"make_unique", "make_shared", "allocate_shared"};

    return cfg;
}
} // namespace

const LanguageTokenConfig& language_tokens(LanguageId language_id)
{
    static const LanguageTokenConfig cpp_tokens = build_cpp_tokens();

    switch (language_id)
    {
        case LanguageId::Cpp:
            return cpp_tokens;
    }

    throw std::runtime_error("Unsupported language id");
}

std::string lowercase_ascii(const std::string& input)
{
    std::string lowered = input;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return lowered;
}
