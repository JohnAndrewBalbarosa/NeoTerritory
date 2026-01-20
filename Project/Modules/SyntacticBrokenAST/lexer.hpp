#pragma once

#include "token.hpp"

#include <cstddef>
#include <string>
#include <unordered_set>
#include <vector>

class Lexer {
   public:
    explicit Lexer(std::string source);
    std::vector<Token> scan();

   private:
    Token scanToken();
    Token stringLiteral();
    Token blockComment();
    bool match(char expected);
    char peek() const;
    char advance();
    bool isAtEnd() const;
    Token makeToken(TokenType type, const std::string& lexeme) const;
    Token makeError(const std::string& message, const std::string& lexeme) const;

    static const std::unordered_set<std::string> keywords_;

    std::string source_;
    size_t length_ {0};
    size_t current_ {0};
    size_t line_ {1};
    size_t column_ {1};
    size_t start_ {0};
    size_t startLine_ {1};
    size_t startColumn_ {1};
};

std::string readAllStdin();
