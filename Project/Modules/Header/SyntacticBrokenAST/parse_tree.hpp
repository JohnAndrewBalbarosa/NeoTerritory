#ifndef PARSE_TREE_HPP
#define PARSE_TREE_HPP

#include <string>
#include <vector>

struct ParseTreeNode
{
    std::string kind;
    std::string value;
    std::vector<ParseTreeNode> children;
};

/**
 * @brief Parse C++ source code into a lightweight hierarchical parse tree.
 */
ParseTreeNode build_cpp_parse_tree(const std::string& source);

/**
 * @brief Render parse tree as indented text for terminal output.
 */
std::string parse_tree_to_text(const ParseTreeNode& root);
std::string parse_tree_to_html(const ParseTreeNode& root);

#endif // PARSE_TREE_HPP
