#include "Analysis/Patterns/Creational/Transform/FactoryReverse/core.hpp"
#include "Analysis/Patterns/Families/Creational/Transform/internal/creational_transform_factory_reverse_internal.hpp"

FactoryReverseTransformResult transform_factory_to_base_by_direct_instantiation(
    ParseTreeNode&,
    const std::string& factory_class_name)
{
    FactoryReverseTransformResult result;
    result.class_name = factory_class_name;
    return result;
}
