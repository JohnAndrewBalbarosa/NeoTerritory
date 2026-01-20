#include "ast_utils.hpp"

#include <algorithm>
#include <iostream>
#include <string>

void traverse(ASTNode* node, std::function<void(ASTNode*)> callback) {
    if (!node || !callback) {
        return;
    }
    callback(node);
    for (ASTNode* child : node->children) {
        traverse(child, callback);
    }
}

int semantic_height(ASTNode* node) {
    if (!node) {
        return 0;
    }
    int maxChild = 0;
    for (ASTNode* child : node->children) {
        maxChild = std::max(maxChild, semantic_height(child));
    }
    return 1 + maxChild;
}

int physical_height(ASTNode* node) {
    if (!node) {
        return 0;
    }
    int maxChild = 0;
    for (ASTNode* child : node->children) {
        maxChild = std::max(maxChild, physical_height(child));
    }
    return 1 + maxChild;
}

void print_tree(ASTNode* node, int depth) {
    if (!node) {
        return;
    }
    std::string indent(depth * 2, ' ');
    std::cout << indent << "ASTNode@" << node << " (" << node->line << ':' << node->column << ")\n";
    for (ASTNode* child : node->children) {
        print_tree(child, depth + 1);
    }
}
