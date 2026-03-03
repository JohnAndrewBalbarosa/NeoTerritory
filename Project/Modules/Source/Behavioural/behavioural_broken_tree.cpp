#include "behavioural_broken_tree.hpp"

#include "Logic/behavioural_logic_scaffold.hpp"
#include "tree_html_renderer.hpp"

#include <utility>

ParseTreeNode build_behavioural_broken_tree(const ParseTreeNode& parse_root)
{
    ParseTreeNode root{"BehaviouralPatternsRoot", "function scaffold + structure checks", {}};

    ParseTreeNode function_scaffold = build_behavioural_function_scaffold(parse_root);
    if (!function_scaffold.children.empty())
    {
        root.children.push_back(std::move(function_scaffold));
    }

    ParseTreeNode structure_checks = build_behavioural_structure_checker(parse_root);
    if (!structure_checks.children.empty())
    {
        root.children.push_back(std::move(structure_checks));
    }

    if (root.children.empty())
    {
        root.value = "NoBehaviouralPatternStructureFound";
    }

    return root;
}

std::string behavioural_broken_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(
        root,
        "Behavioural Broken AST",
        "No behavioural pattern structures found.");
}
