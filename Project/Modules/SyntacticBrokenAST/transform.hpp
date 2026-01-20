#pragma once

#include "ast.hpp"
#include "virtual_node.hpp"

VirtualNode* wrap_node(ASTNode* target, bool dirty = true);
