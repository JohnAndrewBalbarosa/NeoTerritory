#pragma once

#include "Analysis/Patterns/Creational/Transform/FactoryReverse/core.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <string>
#include <vector>

struct FactoryReverseParsedLiteral
{
    std::string kind_value;
    std::string created_class_name;
};

struct FactoryReverseMapping
{
    std::string                              factory_class_name;
    std::vector<FactoryReverseParsedLiteral> literal_mappings;
};

std::vector<FactoryReverseParsedLiteral> parse_factory_reverse_literals(const ParseTreeNode& factory_node);

FactoryReverseMapping parse_factory_reverse_mapping(const ParseTreeNode& factory_node);

void rewrite_factory_call_sites(ParseTreeNode& root, const FactoryReverseMapping& mapping);

void cleanup_factory_remnants(ParseTreeNode& root, const std::string& factory_class_name);
