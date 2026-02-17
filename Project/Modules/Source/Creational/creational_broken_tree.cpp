#include "creational_broken_tree.hpp"
#include "Factory/factory_pattern_logic.hpp"
#include "Singleton/singleton_pattern_logic.hpp"
#include "tree_html_renderer.hpp"

#include <functional>
#include <sstream>
#include <string>

CreationalTreeNode build_creational_broken_tree(const ParseTreeNode& root)
{
    CreationalTreeNode out{"CreationalPatternsRoot", "factory + singleton", {}};

    CreationalTreeNode factory_tree = build_factory_pattern_tree(root);
    if (!factory_tree.children.empty())
    {
        out.children.push_back(std::move(factory_tree));
    }

    CreationalTreeNode singleton_tree = build_singleton_pattern_tree(root);
    if (!singleton_tree.children.empty())
    {
        out.children.push_back(std::move(singleton_tree));
    }

    if (out.children.empty())
    {
        out.label = "NoFactoryOrSingletonPatternFound";
    }

    return out;
}

ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode& root)
{
    ParseTreeNode out;
    out.kind = root.kind;
    out.value = root.label;

    for (const CreationalTreeNode& child : root.children)
    {
        out.children.push_back(creational_tree_to_parse_tree_node(child));
    }

    return out;
}

std::string creational_tree_to_html(const CreationalTreeNode& root)
{
    const ParseTreeNode parse_root = creational_tree_to_parse_tree_node(root);
    return render_tree_html(
        parse_root,
        "Creational Broken Tree",
        "No creational (factory/singleton) pattern found in this source.");
}

std::string creational_tree_to_text(const CreationalTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const CreationalTreeNode&, int)> walk = [&](const CreationalTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;
        if (!node.label.empty())
        {
            out << ": " << node.label;
        }
        out << '\n';

        for (const CreationalTreeNode& child : node.children)
        {
            walk(child, depth + 1);
        }
    };

    walk(root, 0);
    return out.str();
}
