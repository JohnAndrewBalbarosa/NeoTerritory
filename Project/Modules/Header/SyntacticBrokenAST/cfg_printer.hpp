#ifndef CFG_PRINTER_HPP
#define CFG_PRINTER_HPP

#include "ast.hpp"

/**
 * @brief Prints CFG tree structure with clear hierarchy
 * 
 * Shows main function as root and function calls as children
 * in a clear hierarchical format
 * 
 * @param root Root node of the CFG tree
 */
void print_cfg_tree(ASTNode* root);

#endif // CFG_PRINTER_HPP
