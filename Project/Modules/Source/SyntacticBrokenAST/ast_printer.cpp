#include "ast_printer.hpp"
#include "ast_utils.hpp"
#include "virtual_node.hpp"
#include <iostream>

struct FunctionCallNode : ASTNode
{
    std::string name;
    std::vector<std::string> arguments;
};

struct FunctionDeclNode : ASTNode
{
    std::string name;
};

void print_ast_analysis(ASTNode* root)
{
    std::cout << "=== Synthetic AST Dump ===\n";
    print_tree(root);
    std::cout << "Semantic height: " << semantic_height(root)
              << " | Physical height: " << physical_height(root) << '\n';

    traverse(root, [](ASTNode* node)
    {
        if (auto* wrapper = dynamic_cast<VirtualNode*>(node)) {
            std::cout << "Wrapper @" << wrapper->wrapper_line << ':' << wrapper->wrapper_column
                      << " dirty=" << (wrapper->dirty ? "yes" : "no");
            if (wrapper->target) {
                if (auto* call = dynamic_cast<FunctionCallNode*>(wrapper->target)) {
                    std::cout << " -> FunctionCall '" << call->name << "' @" 
                              << call->line << ":" << call->column
                              << " (args: " << call->arguments.size() << ")";
                } else if (auto* decl = dynamic_cast<FunctionDeclNode*>(wrapper->target)) {
                    std::cout << " -> FunctionDecl '" << decl->name << "' @"
                              << decl->line << ":" << decl->column;
                } else {
                    std::cout << " -> target@" << wrapper->target;
                }
            }
            std::cout << '\n';
        }
    });
}
