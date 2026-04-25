#pragma once

#include <string>
#include <vector>

struct ParseTreeNode;

struct FactoryReverseTransformResult
{
    bool                     transformed = false;
    std::string              class_name;
    std::vector<std::string> reasons;
};

FactoryReverseTransformResult transform_factory_to_base_by_direct_instantiation(
    ParseTreeNode&     root,
    const std::string& factory_class_name);
