#include "cfg_printer.hpp"
#include "virtual_node.hpp"
#include <iostream>
#include <string>

struct FunctionCallNode : ASTNode
{
    std::string name;
    std::vector<std::string> arguments;
};

struct FunctionDeclNode : ASTNode
{
    std::string name;
};

void print_cfg_tree(ASTNode* root)
{
    if (!root) {
        std::cout << "(empty tree)\n";
        return;
    }

    // Print root (main function) - check for direct FunctionDeclNode first (no wrapper)
    if (auto* decl = dynamic_cast<FunctionDeclNode*>(root)) {
        std::cout << "[ROOT] Function: " << decl->name << "()\n";
        std::cout << "       Location: Line " << decl->line << ", Column " << decl->column << "\n";
        
        if (root->children.empty()) {
            std::cout << "       (no function calls inside)\n";
        } else {
            std::cout << "       Children (Function Calls):\n";
            
            // Print children (function calls)
            for (size_t i = 0; i < root->children.size(); ++i) {
                ASTNode* child = root->children[i];
                
                if (auto* child_vnode = dynamic_cast<VirtualNode*>(child)) {
                    if (auto* call = dynamic_cast<FunctionCallNode*>(child_vnode->target)) {
                        std::cout << "       ├─ [" << (i + 1) << "] Call: " << call->name << "()\n";
                        std::cout << "       │     Location: Line " << call->line << ", Column " << call->column << "\n";
                        std::cout << "       │     Arguments: " << call->arguments.size() << "\n";
                        std::cout << "       │     Dirty bit: " << (child_vnode->dirty ? "yes" : "no") << "\n";
                        
                        if (i < root->children.size() - 1) {
                            std::cout << "       │\n";
                        }
                    }
                }
            }
        }
    }
    // Print root (main function) - wrapped in VirtualNode (fallback)
    else if (auto* vnode = dynamic_cast<VirtualNode*>(root)) {
        if (auto* decl = dynamic_cast<FunctionDeclNode*>(vnode->target)) {
            std::cout << "[ROOT] Function: " << decl->name << "()\n";
            std::cout << "       Location: Line " << decl->line << ", Column " << decl->column << "\n";
            std::cout << "       Dirty bit: " << (vnode->dirty ? "yes" : "no") << "\n";
            
            if (root->children.empty()) {
                std::cout << "       (no function calls inside)\n";
            } else {
                std::cout << "       Children (Function Calls):\n";
                
                // Print children (function calls)
                for (size_t i = 0; i < root->children.size(); ++i) {
                    ASTNode* child = root->children[i];
                    
                    if (auto* child_vnode = dynamic_cast<VirtualNode*>(child)) {
                        if (auto* call = dynamic_cast<FunctionCallNode*>(child_vnode->target)) {
                            std::cout << "       ├─ [" << (i + 1) << "] Call: " << call->name << "()\n";
                            std::cout << "       │     Location: Line " << call->line << ", Column " << call->column << "\n";
                            std::cout << "       │     Arguments: " << call->arguments.size() << "\n";
                            std::cout << "       │     Dirty bit: " << (child_vnode->dirty ? "yes" : "no") << "\n";
                            
                            if (i < root->children.size() - 1) {
                                std::cout << "       │\n";
                            }
                        }
                    }
                }
            }
        } else {
            std::cout << "[ROOT] VirtualNode (target not a function declaration)\n";
        }
    } else {
        std::cout << "[ROOT] ASTNode @" << root << "\n";
    }
}
