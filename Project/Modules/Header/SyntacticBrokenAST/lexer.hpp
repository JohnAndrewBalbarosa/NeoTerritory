#pragma once

#include "token.hpp"

#include <cstddef>
#include <string>
#include <unordered_set>
#include <vector>

/**
 * @brief Lexical analyzer for C++ source code
 * 
 * Scans source code and produces a sequence of tokens for parsing.
 * Handles keywords, operators, literals, identifiers, and comments.
 */
class Lexer {
   public:
    /**
     * @brief Constructs a lexer with the given source code
     * @param source The source code to tokenize
     * @param startLine Starting line number (default: 1)
     */
    explicit Lexer(std::string source, size_t startLine = 1);
    
    /**
     * @brief Scans the entire source and returns all tokens
     * @return Vector of tokens including an EndOfFile token
     */
    std::vector<Token> scan();

   private:
    // Scanning methods
    Token scanToken();
    Token stringLiteral();
    Token blockComment();
    
    // Character processing utilities
    bool match(char expected);
    char peek() const;
    char advance();
    bool isAtEnd() const;
    
    // Token creation helpers
    Token makeToken(TokenType type, const std::string& lexeme) const;
    Token makeError(const std::string& message, const std::string& lexeme) const;

    // Static data
    static const std::unordered_set<std::string> keywords_;

    // Instance state
    std::string source_;        // Source code being scanned
    size_t length_{0};          // Total length of source
    size_t current_{0};         // Current position in source
    size_t line_{1};            // Current line number
    size_t column_{1};          // Current column number
    size_t start_{0};           // Start of current token
    size_t startLine_{1};       // Line where current token starts
    size_t startColumn_{1};     // Column where current token starts
};

/**
 * @brief Reads all input from standard input
 * @return String containing all stdin content
 */
std::string readAllStdin();
