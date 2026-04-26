#include "OutputGeneration/UnitTestGeneration/core.hpp"

#include <cstddef>
#include <functional>
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

std::string find_class_name(const std::vector<LexicalToken>& tokens)
{
    for (std::size_t i = 0; i + 1 < tokens.size(); ++i)
    {
        if (tokens[i].kind == LexicalTokenKind::Keyword &&
            (tokens[i].lexeme == "class" || tokens[i].lexeme == "struct"))
        {
            for (std::size_t j = i + 1; j < tokens.size(); ++j)
            {
                if (tokens[j].kind == LexicalTokenKind::Identifier) return tokens[j].lexeme;
                if (tokens[j].kind == LexicalTokenKind::Punctuation &&
                    (tokens[j].lexeme == "{" || tokens[j].lexeme == ";"))
                {
                    break;
                }
            }
        }
    }
    return {};
}

bool prev_token_is_tilde(const std::vector<LexicalToken>& tokens, std::size_t identifier_index)
{
    if (identifier_index == 0) return false;
    const LexicalToken& prev = tokens[identifier_index - 1];
    return prev.kind == LexicalTokenKind::Operator && prev.lexeme == "~";
}

std::size_t hash_function_identity(
    std::size_t        class_hash,
    const std::string& function_name,
    const std::string& branch_kind,
    std::size_t        line)
{
    const std::hash<std::string> hasher;
    std::size_t mix = class_hash;
    mix ^= hasher(function_name) + 0x9e3779b97f4a7c15ull + (mix << 6) + (mix >> 2);
    mix ^= hasher(branch_kind)   + 0x9e3779b97f4a7c15ull + (mix << 6) + (mix >> 2);
    mix ^= line                  + 0x9e3779b97f4a7c15ull + (mix << 6) + (mix >> 2);
    return mix;
}
} // namespace

std::vector<UnitTestTarget> extract_unit_test_targets(const ClassTokenStream& class_stream)
{
    std::vector<UnitTestTarget> targets;
    const std::vector<LexicalToken>& tokens = class_stream.tokens;
    const std::string class_name = find_class_name(tokens);

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
            if (!class_name.empty() && token.lexeme == class_name)
            {
                target.branch_kind = prev_token_is_tilde(tokens, i) ? "destructor" : "constructor";
            }
            else
            {
                target.branch_kind = "method";
            }
            target.function_hash = hash_function_identity(
                class_stream.class_hash, target.function_name, target.branch_kind, target.line);
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
            target.function_hash = hash_function_identity(
                class_stream.class_hash, std::string(), target.branch_kind, target.line);
            targets.push_back(std::move(target));
        }
    }

    return targets;
}
