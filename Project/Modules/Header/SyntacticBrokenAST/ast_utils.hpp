#pragma once

#include "ast.hpp"

#include <functional>

void traverse(ASTNode* node, std::function<void(ASTNode*)> callback);

int semantic_height(ASTNode* node);
int physical_height(ASTNode* node);
void print_tree(ASTNode* node, int depth = 0);
