#pragma once

#include <string>

struct ParseTreeNode;

std::string render_tree_html(const ParseTreeNode& root);
