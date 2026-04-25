#pragma once

#include "Trees/Actual/parse_tree.hpp"

#include <memory>
#include <string>
#include <vector>

struct CreationalTreeNode
{
    std::string                     pattern_name;
    std::string                     class_name;
    std::size_t                     class_hash = 0;
    std::vector<std::string>        evidence;
    std::vector<CreationalTreeNode> children;
};

struct ICreationalDetector
{
    virtual ~ICreationalDetector() = default;
    virtual bool        detect(const ParseTreeNode& class_node) const = 0;
    virtual std::string pattern_name() const                          = 0;
};

struct ICreationalTreeCreator
{
    virtual ~ICreationalTreeCreator() = default;
    virtual CreationalTreeNode create(const ParseTreeNode& class_node) const = 0;
    virtual std::string        pattern_name() const                          = 0;
};

CreationalTreeNode build_creational_broken_tree(
    const ParseTreeNode&                                        root,
    const std::vector<std::unique_ptr<ICreationalDetector>>&    detectors,
    const std::vector<std::unique_ptr<ICreationalTreeCreator>>& creators);

ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode& tree);

std::string creational_tree_to_html(const CreationalTreeNode& tree);

std::string creational_tree_to_text(const CreationalTreeNode& tree);
