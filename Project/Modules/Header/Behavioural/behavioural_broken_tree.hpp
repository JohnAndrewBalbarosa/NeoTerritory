#ifndef BEHAVIOURAL_BROKEN_TREE_HPP
#define BEHAVIOURAL_BROKEN_TREE_HPP

#include "parse_tree.hpp"

#include <string>
#include <vector>

class IBehaviouralDetector
{
public:
    virtual ~IBehaviouralDetector() = default;
    virtual ParseTreeNode detect(const ParseTreeNode& parse_root) const = 0;
};

class IBehaviouralTreeCreator
{
public:
    virtual ~IBehaviouralTreeCreator() = default;
    virtual ParseTreeNode create(
        const ParseTreeNode& parse_root,
        const std::vector<const IBehaviouralDetector*>& detectors) const = 0;
};

/**
 * @brief Build behavioural broken tree:
 * function scaffold + behavioural structure-check candidates.
 */
ParseTreeNode build_behavioural_broken_tree(const ParseTreeNode& parse_root);
ParseTreeNode build_behavioural_broken_tree(
    const ParseTreeNode& parse_root,
    const IBehaviouralTreeCreator& creator,
    const std::vector<const IBehaviouralDetector*>& detectors);
std::string behavioural_broken_tree_to_html(const ParseTreeNode& root);

#endif // BEHAVIOURAL_BROKEN_TREE_HPP
