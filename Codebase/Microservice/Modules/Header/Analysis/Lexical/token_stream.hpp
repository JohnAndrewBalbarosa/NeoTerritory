#pragma once

#include <cstddef>
#include <string>
#include <vector>

enum class LexicalTokenKind
{
    Unknown,
    Keyword,
    Identifier,
    Punctuation,
    Operator,
    Literal,
    String,
    Number,
    Comment,
    Whitespace,
    EndOfStream,
};

struct LexicalToken
{
    LexicalTokenKind kind   = LexicalTokenKind::Unknown;
    std::string      lexeme;
    std::size_t      line   = 0;
    std::size_t      column = 0;
};

struct ClassTokenStream
{
    std::size_t                class_hash = 0;
    std::string                class_name;
    std::string                file_name;
    std::string                class_text;
    std::vector<LexicalToken>  tokens;
};

std::vector<LexicalToken> tokenize_cpp_source(const std::string& source);

ClassTokenStream extract_class_token_stream(
    const std::string& class_text,
    std::size_t        class_hash,
    const std::string& file_name);
