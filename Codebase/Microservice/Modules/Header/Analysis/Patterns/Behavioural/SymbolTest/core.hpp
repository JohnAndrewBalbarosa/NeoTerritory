#pragma once

#include <string>

struct ParseTreeNode;

ParseTreeNode build_behavioural_symbol_test_tree(const ParseTreeNode& root);

std::string behavioural_symbol_test_to_text(const ParseTreeNode& test_tree);
