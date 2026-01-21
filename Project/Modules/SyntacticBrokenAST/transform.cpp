#include "transform.hpp"

VirtualNode* wrap_node(ASTNode* target, bool dirty) {
    if (!target) {
        return nullptr;
    }
    VirtualNode* wrapper = new VirtualNode(target, dirty);
    wrapper->wrapper_line = target->line;
    wrapper->wrapper_column = target->column;
    wrapper->line = target->line;
    wrapper->column = target->column;
    return wrapper;
}
