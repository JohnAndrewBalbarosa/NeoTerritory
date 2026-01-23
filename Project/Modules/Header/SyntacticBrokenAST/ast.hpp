#pragma once

#include <cstddef>
#include <vector>

struct ASTNode {
    std::vector<ASTNode*> children;
    size_t line {0};
    size_t column {0};

    virtual ~ASTNode() = default;

    void addChild(ASTNode* child) {
        if (child) {
            children.push_back(child);
        }
    }
};
