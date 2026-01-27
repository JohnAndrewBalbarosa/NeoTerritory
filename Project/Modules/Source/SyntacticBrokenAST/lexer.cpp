#include "lexer.hpp"

#include <cctype>
#include <fstream>
#include <iostream>
#include <sstream>
#include <utility>

Lexer::Lexer(std::string source)
    : source_(std::move(source)), length_(source_.size()) {}

std::vector<Token> Lexer::scan() {
    std::vector<Token> tokens;
        while (!isAtEnd()) {
        start_ = current_;
         startLine_ = line_;
        startColumn_ = column_;
        Token tok = scanToken();
        if (tok.type != TokenType::Error && tok.type != TokenType::EndOfFile && tok.lexeme.empty()) {
            continue;
        }
        tokens.push_back(std::move(tok));
        if (tokens.back().type == TokenType::Error) {
            break;
        }
    }
    if (tokens.empty() || tokens.back().type != TokenType::Error) {
        tokens.push_back({TokenType::EndOfFile, "", "", line_, column_});
    }
    return tokens;
}

Token Lexer::scanToken() {
    char c = advance();
    if (std::isspace(static_cast<unsigned char>(c))) {
        if (c == '\n') {
            line_ += 1;
            column_ = 1;
        }
        return Token{TokenType::Delimiter, "", "", startLine_, startColumn_};
    }

    if (std::isalpha(static_cast<unsigned char>(c)) || c == '_') {
        while (std::isalnum(static_cast<unsigned char>(peek())) || peek() == '_') {
            advance();
        }
        std::string lex = source_.substr(start_, current_ - start_);
        if (keywords_.count(lex)) {
            return makeToken(TokenType::Keyword, lex);
        }
        return makeToken(TokenType::Identifier, lex);
     }

    if (std::isdigit(static_cast<unsigned char>(c))) {
        while (std::isdigit(static_cast<unsigned char>(peek()))) {
            advance();
        }
        if (std::isalpha(static_cast<unsigned char>(peek()))) {
            while (std::isalnum(static_cast<unsigned char>(peek()))) {
                advance();
            }
            std::string bad = source_.substr(start_, current_ - start_);
            return makeError("Invalid numeric literal", bad);
        }
        std::string lex = source_.substr(start_, current_ - start_);
        return makeToken(TokenType::IntegerLiteral, lex);
    }

    if (c == '"') {
        return stringLiteral();
    }

    if (c == '\'') {
        // Handle character literal
        bool terminated = false;
        while (!isAtEnd()) {
            char ch = advance();
            if (ch == '\n') {
                line_ += 1;
                column_ = 1;
            }
            if (ch == '\'') {
                terminated = true;
                break;
            }
            if (ch == '\\') {
                advance();
                continue;
            }
        }
        if (!terminated) {
            return makeError("Unterminated character literal", source_.substr(start_, current_ - start_));
        }
        std::string lex = source_.substr(start_, current_ - start_);
        return makeToken(TokenType::CharacterLiteral, lex);
    }

    if (c == '/') {
        if (match('/')) {
            while (!isAtEnd() && peek() != '\n') {
                advance();
            }
            return Token{TokenType::Delimiter, "", "", startLine_, startColumn_};
        }
        if (match('*')) {
            return blockComment();
        }
        return makeToken(TokenType::Operator, "/");
    }

    if (c == '=' && match('=')) return makeToken(TokenType::Operator, "==");
    if (c == '!' && match('=')) return makeToken(TokenType::Operator, "!=");
    if (c == '<' && match('=')) return makeToken(TokenType::Operator, "<=");
    if (c == '>' && match('=')) return makeToken(TokenType::Operator, ">=");
    if (c == '&' && match('&')) return makeToken(TokenType::Operator, "&&");
    if (c == '|' && match('|')) return makeToken(TokenType::Operator, "||");

    switch (c) {
        case '+':
        case '-':
        case '*':
        case '%':
        case '!':
        case '=':
        case '<':
        case '>':
            return makeToken(TokenType::Operator, std::string(1, c));
        case ':':
            if (match(':')) {
                return makeToken(TokenType::Operator, "::");
            }
            return makeToken(TokenType::Operator, std::string(1, c));
        case '(':
        case ')':
        case '{':
        case '}':
        case '[':
        case ']':
        case ';':
        case ',':
        case '.':
            return makeToken(TokenType::Delimiter, std::string(1, c));
        case '#':
            return makeToken(TokenType::Preprocessor, std::string(1,c));
        default:
            return makeError("Unrecognized character", std::string(1, c));
    }
}

Token Lexer::stringLiteral() {
    bool terminated = false;
    while (!isAtEnd()) {
        char c = advance();
        if (c == '\n') {
            line_ += 1;
            column_ = 1;
        }
        if (c == '"') {
            terminated = true;
            break;
        }
        if (c == '\\') {
            advance();
            continue;
        }
    }

    if (!terminated) {
        return makeError("Unterminated string literal", source_.substr(start_, current_ - start_));
    }
    std::string lex = source_.substr(start_, current_ - start_);
    return makeToken(TokenType::StringLiteral, lex);
}

Token Lexer::blockComment() {
    while (!isAtEnd()) {
        char c = advance();
        if (c == '\n') {
            line_ += 1;
            column_ = 1;
        }
        if (c == '*' && match('/')) {
            return Token{TokenType::Delimiter, "", "", startLine_, startColumn_};
        }
    }
    return makeError("Unterminated block comment", source_.substr(start_, current_ - start_));
}

bool Lexer::match(char expected) {
    if (isAtEnd()) return false;
    if (source_[current_] != expected) return false;
    current_ += 1;
    column_ += 1;
    return true;
}

char Lexer::peek() const {
    if (isAtEnd()) return '\0';
    return source_[current_];
}

char Lexer::advance() {
    char c = source_[current_];
    current_ += 1;
    column_ += 1;
    return c;
}

bool Lexer::isAtEnd() const { return current_ >= length_; }

Token Lexer::makeToken(TokenType type, const std::string& lexeme) const {
    return Token{type, lexeme, "", startLine_, startColumn_};
}

Token Lexer::makeError(const std::string& message, const std::string& lexeme) const {
    return Token{TokenType::Error, lexeme, message, startLine_, startColumn_};
}

const std::unordered_set<std::string> Lexer::keywords_ {
    "if", "else", "for", "while", "return", "int", "double", "float", "char",
    "bool", "void", "class", "struct", "public", "private", "protected",
    "virtual", "override", "const", "static", "using", "namespace", "new",
    "delete", "true", "false", "include", "define", "ifdef", "ifndef", "endif"
};

std::string readAllStdin() {
    std::ostringstream oss;
    oss << std::cin.rdbuf();
    return oss.str();
}