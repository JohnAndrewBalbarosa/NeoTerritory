#include "Trees/Broken/Creational/tree.hpp"

CreationalTreeNode build_creational_broken_tree(
    const ParseTreeNode&,
    const std::vector<std::unique_ptr<ICreationalDetector>>&,
    const std::vector<std::unique_ptr<ICreationalTreeCreator>>&)
{
    return {};
}

ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode&)
{
    return {};
}

std::string creational_tree_to_html(const CreationalTreeNode&)
{
    return {};
}

std::string creational_tree_to_text(const CreationalTreeNode&)
{
    return {};
}
