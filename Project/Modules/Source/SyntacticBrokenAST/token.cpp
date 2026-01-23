#include "token.hpp"

std::string token_type_to_string(TokenType type) {
    switch (type) {
        case TokenType::Identifier: return "Identifier";
        case TokenType::Keyword: return "Keyword";
        case TokenType::IntegerLiteral: return "IntegerLiteral";
        case TokenType::StringLiteral: return "StringLiteral";
        case TokenType::Operator: return "Operator";
        case TokenType::Delimiter: return "Delimiter";
        case TokenType::Error: return "Error";
        case TokenType::EndOfFile: return "EOF";
    }
    return "Unknown";
}
