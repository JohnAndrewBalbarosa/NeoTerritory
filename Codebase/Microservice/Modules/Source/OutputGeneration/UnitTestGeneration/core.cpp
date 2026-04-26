#include "OutputGeneration/UnitTestGeneration/core.hpp"

#include <cstddef>
#include <string>
#include <unordered_set>

namespace
{
const std::unordered_set<std::string>& branch_keywords()
{
    static const std::unordered_set<std::string> keywords = {
        "if", "else", "while", "for", "switch", "case", "do", "catch",
    };
    return keywords;
}

bool is_branch_keyword(const LexicalToken& token)
{
    return token.kind == LexicalTokenKind::Keyword &&
           branch_keywords().count(token.lexeme) != 0;
}

bool looks_like_method_declaration(
    const std::vector<LexicalToken>& tokens,
    std::size_t                      identifier_index,
    int                              brace_depth)
{
    if (brace_depth != 1) return false;
    if (identifier_index + 1 >= tokens.size()) return false;
    const LexicalToken& next = tokens[identifier_index + 1];
    if (next.kind != LexicalTokenKind::Punctuation || next.lexeme != "(") return false;

    if (identifier_index > 0)
    {
        const LexicalToken& prev = tokens[identifier_index - 1];
        if (prev.kind == LexicalTokenKind::Punctuation && prev.lexeme == ".") return false;
        if (prev.kind == LexicalTokenKind::Operator && prev.lexeme == "->") return false;
    }
    return true;
}
} // namespace

std::vector<UnitTestTarget> extract_unit_test_targets(const ClassTokenStream& class_stream)
{
    std::vector<UnitTestTarget> targets;
    const std::vector<LexicalToken>& tokens = class_stream.tokens;

    int brace_depth = 0;
    for (std::size_t i = 0; i < tokens.size(); ++i)
    {
        const LexicalToken& token = tokens[i];
        if (token.kind == LexicalTokenKind::Punctuation)
        {
            if (token.lexeme == "{") { ++brace_depth; continue; }
            if (token.lexeme == "}") { --brace_depth; continue; }
        }

        if (token.kind == LexicalTokenKind::Identifier &&
            looks_like_method_declaration(tokens, i, brace_depth))
        {
            UnitTestTarget target;
            target.containing_class_hash = class_stream.class_hash;
            target.function_name         = token.lexeme;
            target.file_name             = class_stream.file_name;
            target.line                  = token.line;
            target.branch_kind           = "method";
            targets.push_back(std::move(target));
            continue;
        }

        if (is_branch_keyword(token) && brace_depth >= 2)
        {
            UnitTestTarget target;
            target.containing_class_hash = class_stream.class_hash;
            target.file_name             = class_stream.file_name;
            target.line                  = token.line;
            target.branch_kind           = token.lexeme;
            targets.push_back(std::move(target));
        }
    }

    return targets;
}
