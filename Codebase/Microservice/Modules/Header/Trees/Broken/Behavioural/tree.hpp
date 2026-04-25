#pragma once

#include "Trees/Actual/parse_tree.hpp"

#include <memory>
#include <string>
#include <vector>

struct IBehaviouralDetector
{
    virtual ~IBehaviouralDetector() = default;
    virtual bool        detect(const ParseTreeNode& class_node) const = 0;
    virtual std::string pattern_name() const                          = 0;
};

struct IBehaviouralTreeCreator
{
    virtual ~IBehaviouralTreeCreator() = default;
    virtual ParseTreeNode create(const ParseTreeNode& class_node) const = 0;
    virtual std::string   pattern_name() const                          = 0;
};

ParseTreeNode build_behavioural_broken_tree(
    const ParseTreeNode&                                       root,
    const std::vector<std::unique_ptr<IBehaviouralDetector>>&  detectors,
    const std::vector<std::unique_ptr<IBehaviouralTreeCreator>>& creators);

std::string behavioural_tree_to_html(const ParseTreeNode& tree);

std::string behavioural_tree_to_text(const ParseTreeNode& tree);
