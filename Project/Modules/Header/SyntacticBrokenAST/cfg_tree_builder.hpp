#ifndef CFG_TREE_BUILDER_HPP
#define CFG_TREE_BUILDER_HPP

#include "token.hpp"
#include "ast.hpp"
#include "function_parser.hpp"
#include <vector>

/**
 * @brief Builds syntactic tree using CFG starting from main function
 * 
 * Creates a tree structure where:
 * - Main function is the root
 * - Function calls within function bodies are added as children
 * - Traverses through function definitions and their contents
 * 
 * @param tokens Vector of tokens from lexer
 * @param parsed ParsedNodes containing all parsed nodes
 * @return Root node of the CFG-based syntactic tree
 */
ASTNode* build_cfg_tree(const std::vector<Token>& tokens, const ParsedNodes& parsed);

#endif // CFG_TREE_BUILDER_HPP
