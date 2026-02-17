#ifndef TREE_HTML_RENDERER_HPP
#define TREE_HTML_RENDERER_HPP

#include "parse_tree.hpp"

#include <string>

/**
 * @brief Render any ParseTreeNode tree into a full HTML document.
 */
std::string render_tree_html(
    const ParseTreeNode& root,
    const std::string& title,
    const std::string& empty_message = "No nodes found.");

#endif // TREE_HTML_RENDERER_HPP
