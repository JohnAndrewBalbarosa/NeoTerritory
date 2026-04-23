#ifndef CREATIONAL_PATTERN_MEDIATOR_HPP
#define CREATIONAL_PATTERN_MEDIATOR_HPP

#include "creational_broken_tree.hpp"
#include "parse_tree.hpp"
#include "parse_tree_symbols.hpp"

#include <string>
#include <vector>

struct CreationalRegisteredClass
{
    std::string name;
    const ParseTreeNode* node = nullptr;
    const ParseSymbol* symbol = nullptr;
};

class ICreationalPatternAlgorithm
{
public:
    virtual ~ICreationalPatternAlgorithm() = default;
    virtual std::string pattern_root_kind() const = 0;
    virtual std::string pattern_root_label() const = 0;
    virtual bool inspect_registered_class(
        const CreationalRegisteredClass& registered_class,
        const ParseTreeSymbolTables& tables,
        CreationalTreeNode& out_class_node) const = 0;
};

std::vector<CreationalRegisteredClass> register_creational_classes(
    const ParseTreeNode& parse_root,
    const ParseTreeSymbolTables& tables);

CreationalTreeNode build_creational_pattern_tree_with_mediator(
    const ParseTreeNode& parse_root,
    const ICreationalPatternAlgorithm& algorithm);

CreationalTreeNode build_creational_family_tree_with_mediator(
    const ParseTreeNode& parse_root,
    const std::vector<const ICreationalPatternAlgorithm*>& algorithms);

#endif // CREATIONAL_PATTERN_MEDIATOR_HPP
