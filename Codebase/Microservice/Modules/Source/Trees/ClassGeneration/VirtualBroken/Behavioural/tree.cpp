#include "Trees/Broken/Behavioural/tree.hpp"

ParseTreeNode build_behavioural_broken_tree(
    const ParseTreeNode&,
    const std::vector<std::unique_ptr<IBehaviouralDetector>>&,
    const std::vector<std::unique_ptr<IBehaviouralTreeCreator>>&)
{
    return {};
}

std::string behavioural_tree_to_html(const ParseTreeNode&)
{
    return {};
}

std::string behavioural_tree_to_text(const ParseTreeNode&)
{
    return {};
}
