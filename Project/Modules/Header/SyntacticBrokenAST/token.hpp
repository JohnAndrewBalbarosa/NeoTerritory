#pragma once

#include <cstddef>
#include <string>

enum class TokenType {
    Preprocessor,
    Identifier,
    Keyword,
    IntegerLiteral,
    StringLiteral,
    CharacterLiteral,
    Operator,
    Delimiter,
    Error,
    EndOfFile
};

struct Token {
    TokenType type;
    std::string lexeme;
    std::string message;  // Only used when reporting errors.
    size_t line;
    size_t column;
};

std::string token_type_to_string(TokenType type);
