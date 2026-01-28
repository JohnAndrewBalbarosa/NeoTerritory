#pragma once

#include "token.hpp"
#include "ast.hpp"

#include <vector>
#include <cstddef>

/**
 * @brief AST node representing a function call
 */
struct FunctionCallNode : ASTNode {
    std::string name;
};

/**
 * @brief Detects and creates AST nodes for function calls from token stream
 */
class FunctionCallDetector {
public:
    /**
     * @brief Detects if tokens at position form a function call pattern
     * @param tokens Vector of tokens to analyze
     * @param identifier_pos Position of identifier token
     * @return ASTNode pointer if function call detected, nullptr otherwise
     */
    static ASTNode* detect_function_call(
        const std::vector<Token>& tokens, 
        size_t identifier_pos
    );
};
