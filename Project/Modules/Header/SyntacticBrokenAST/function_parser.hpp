#ifndef FUNCTION_PARSER_HPP
#define FUNCTION_PARSER_HPP

#include "token.hpp"
#include "ast.hpp"
#include <vector>

/**
 * @brief Storage for parsed nodes ready for syntactic tree construction
 */
struct ParsedNodes {
    std::vector<ASTNode*> function_calls;
    std::vector<ASTNode*> function_decls;
    std::vector<ASTNode*> all_nodes;
    ASTNode* main_root {nullptr};  // Main function definition as root of virtual copy parse tree
};

/**
 * @brief Parses tokens and stores node structures as VirtualNodes
 * 
 * Creates VirtualNode wrappers during parsing and stores them.
 * These stored nodes will be appended to syntactic tree later.
 * 
 * @param tokens Vector of tokens from lexer
 * @return ParsedNodes containing stored VirtualNode structures
 */
ParsedNodes parse_and_store_nodes(const std::vector<Token>& tokens);

/**
 * @brief Temporary: Returns basic AST for current workflow
 */
ASTNode* parse_function_tokens(const std::vector<Token>& tokens);

#endif // FUNCTION_PARSER_HPP
