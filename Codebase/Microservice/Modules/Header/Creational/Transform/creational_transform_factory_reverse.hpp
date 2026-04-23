#ifndef CREATIONAL_TRANSFORM_FACTORY_REVERSE_HPP
#define CREATIONAL_TRANSFORM_FACTORY_REVERSE_HPP

#include "parse_tree_code_generator.hpp"

#include <string>
#include <vector>

namespace creational_codegen_internal
{
struct FactoryReverseTransformResult
{
    std::string transformed_source;
    std::vector<TransformDecision> decisions;
};

FactoryReverseTransformResult transform_factory_to_base_by_direct_instantiation(
    const std::string& source);
} // namespace creational_codegen_internal

#endif // CREATIONAL_TRANSFORM_FACTORY_REVERSE_HPP
