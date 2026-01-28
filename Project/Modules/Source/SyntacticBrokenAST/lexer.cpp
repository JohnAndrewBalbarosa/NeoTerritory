#include "lexer.hpp"
#include "lexer_utils.hpp"
#include "function_call_detector.hpp"

#include <cctype>
#include <iostream>
#include <sstream>
#include <utility>

Lexer::Lexer(std::string source, size_t startLine)
    : source_(std::move(source)), 
      length_(source_.size()), 
      line_(startLine), 
      startLine_(startLine) 
{}

std::vector<Token> Lexer::scan() {
    
    while (!isAtEnd()) {
        start_ = current_;
        startLine_ = line_;
        startColumn_ = column_;
        
        Token tok = scanToken();
        
        if (tok.type != TokenType::Error && 
            tok.type != TokenType::EndOfFile && 
            tok.lexeme.empty()) {
            continue;
        }
        
        tokens_.push_back(std::move(tok));
        
        if (tokens_.back().type == TokenType::Error) {
            break;
        }

        if (tokens_.back().type == TokenType::Identifier) {
             detect_and_store_function_call(tokens_.size() - 1);
        }
    }
    
    if (tokens_.empty() || tokens_.back().type != TokenType::Error) {
        tokens_.push_back({TokenType::EndOfFile, "", "", line_, column_});
    }
    
    return tokens_;
}

void Lexer::detect_and_store_function_call(size_t identifier_pos) {
    ASTNode* call = FunctionCallDetector::detect_function_call(tokens_, identifier_pos);
    if (call) {
        detected_calls_.push_back(call);
    }
}

std::vector<ASTNode*> Lexer::get_detected_function_calls() const {
    return detected_calls_;
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

    if (std::isdigit(static_cast<unsigned char>(c))) {
        while (std::isdigit(static_cast<unsigned char>(peek()))) {
            advance();
        }
        if (is_identifier_continue(peek())) {
            while (is_identifier_continue(peek())) {
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
        return characterLiteral();
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
    if (c == ':' && match(':')) return makeToken(TokenType::Operator, "::");

    switch (c) {
        case '+':
        case '-':
        case '*':
        case '%':
        case '!':
        case '=':
        case '<':
        case '>':
        case ':':
        case '&':
        case '|':
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
        case '@':
        case '$':
        case '~':
        case '`':
        case '?':
        case '\\':
            return makeError("Unrecognized character", std::string(1, c));
    }
    // === Identifiers and Keywords ===
    if (is_identifier_start(c)) {
        while (is_identifier_continue(peek())) {
            advance();
        }
        std::string lex = source_.substr(start_, current_ - start_);
        
        // Check if it's a keyword
        if (keywords_.count(lex)) {
            return makeToken(TokenType::Keyword, lex);
        }
        return makeToken(TokenType::Identifier, lex);
    }
    
    // === Unrecognized Character ===
    return makeError("Unrecognized character", std::string(1, c));
}

// ============================================================================
// Literal Scanning Helpers
// ============================================================================

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
            advance(); // Skip escaped character
            continue;
        }
    }

    if (!terminated) {
        return makeError("Unterminated string literal", 
                       source_.substr(start_, current_ - start_));
    }
    std::string lex = source_.substr(start_, current_ - start_);
    return makeToken(TokenType::StringLiteral, lex);
}

Token Lexer::characterLiteral() {
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
        return makeError("Unterminated character literal", 
                       source_.substr(start_, current_ - start_));
    }
    std::string lex = source_.substr(start_, current_ - start_);
    return makeToken(TokenType::CharacterLiteral, lex);
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
    return makeError("Unterminated block comment", 
                   source_.substr(start_, current_ - start_));
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

bool Lexer::isAtEnd() const { 
    return current_ >= length_; 
}

Token Lexer::makeToken(TokenType type, const std::string& lexeme) const {
    return Token{type, lexeme, "", startLine_, startColumn_};
}

Token Lexer::makeError(const std::string& message, const std::string& lexeme) const {
    return Token{TokenType::Error, lexeme, message, startLine_, startColumn_};
}

const std::unordered_set<std::string> Lexer::keywords_{
    "if", "else", "for", "while", "return",
    "int", "double", "float", "char", "bool", "void",
    "class", "struct", "public", "private", "protected",
    "virtual", "override", "const", "static",
    "using", "namespace",
    "new", "delete",
    "true", "false"
};

std::string readAllStdin() {
    std::ostringstream oss;
    oss << std::cin.rdbuf();
    return oss.str();
}