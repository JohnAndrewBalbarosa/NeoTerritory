#include "behavioural_broken_tree.hpp"

#include "Logic/behavioural_logic_scaffold.hpp"
#include "tree_html_renderer.hpp"

ParseTreeNode build_behavioural_broken_tree(const ParseTreeNode& parse_root)
{
    return build_behavioural_function_scaffold(parse_root);
}

std::string behavioural_broken_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(root, "Behavioural Broken AST", "No function symbols found.");
}
