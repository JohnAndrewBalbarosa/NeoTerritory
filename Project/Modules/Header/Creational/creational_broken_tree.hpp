#ifndef CREATIONAL_BROKEN_TREE_HPP
#define CREATIONAL_BROKEN_TREE_HPP

#include "parse_tree.hpp"

#include <string>
#include <vector>

struct CreationalTreeNode
{
    std::string kind;
    std::string label;
    std::vector<CreationalTreeNode> children;
};

class ICreationalDetector
{
public:
    virtual ~ICreationalDetector() = default;
    virtual CreationalTreeNode detect(const ParseTreeNode& parse_root) const = 0;
};

class ICreationalTreeCreator
{
public:
    virtual ~ICreationalTreeCreator() = default;
    virtual CreationalTreeNode create(
        const ParseTreeNode& parse_root,
        const std::vector<const ICreationalDetector*>& detectors) const = 0;
};

/**
 * @brief Build a simplified creational traversal tree from the base C++ parse tree.
 * Pattern focus: Factory, Singleton, Builder.
 */
CreationalTreeNode build_creational_broken_tree(const ParseTreeNode& root);
CreationalTreeNode build_creational_broken_tree(
    const ParseTreeNode& root,
    const ICreationalTreeCreator& creator,
    const std::vector<const ICreationalDetector*>& detectors);
ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode& root);
std::string creational_tree_to_html(const CreationalTreeNode& root);

/**
 * @brief Print the creational traversal tree as text.
 */
std::string creational_tree_to_text(const CreationalTreeNode& root);

#endif // CREATIONAL_BROKEN_TREE_HPP
