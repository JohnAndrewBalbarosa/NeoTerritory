#include "Logic/creational_logic_scaffold.hpp"

#include "parse_tree_dependency_utils.hpp"

#include <string>
#include <utility>

CreationalTreeNode build_creational_class_scaffold(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{"CreationalEntryRoot", "class traversal scaffold", {}};

    const std::vector<DependencySymbolNode> classes = collect_dependency_class_nodes(parse_root);
    for (const DependencySymbolNode& cls : classes)
    {
        CreationalTreeNode class_node;
        class_node.kind = "ClassNode";
        class_node.label = cls.name + " | hash=" + std::to_string(cls.hash_value);
        root.children.push_back(std::move(class_node));
    }

    return root;
}
