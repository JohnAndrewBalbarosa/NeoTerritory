#ifndef FUNCTION_PARSER_HPP
#define FUNCTION_PARSER_HPP

#include "token.hpp"
#include "ast.hpp"
#include <vector>

/**
 * @brief Parses tokens and builds an AST
 * @param tokens Vector of tokens from lexer
 * @return Root of the AST
 */
ASTNode* parse_function_tokens(const std::vector<Token>& tokens);

#endif // FUNCTION_PARSER_HPP
