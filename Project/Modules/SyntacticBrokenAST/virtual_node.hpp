#pragma once

#include "ast.hpp"

struct VirtualNode : ASTNode {
    ASTNode* target {nullptr};
    bool dirty {false};
    size_t wrapper_line {0};
    size_t wrapper_column {0};

    explicit VirtualNode(ASTNode* target_node = nullptr, bool is_dirty = true)
        : target(target_node), dirty(is_dirty) {
        if (target) {
            wrapper_line = target->line;
            wrapper_column = target->column;
            line = target->line;
            column = target->column;
        }
    }
};
