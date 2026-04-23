#ifndef BUILDER_PATTERN_LOGIC_HPP
#define BUILDER_PATTERN_LOGIC_HPP

#include "creational_broken_tree.hpp"
#include "Logic/creational_pattern_mediator.hpp"
#include "parse_tree.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct BuilderMethodStructureCheck
{
    std::string method_name;
    bool mutates_state = false;
    bool returns_self_type = false;
    bool build_step = false;
};

struct BuilderStructureCheckResult
{
    std::string class_name;
    std::vector<BuilderMethodStructureCheck> methods;
    size_t mutating_chainable_method_count = 0;
    bool has_build_step = false;
    bool conforms = false;
};

/**
 * @brief Check builder conformance with explicit structure metrics:
 * class has >= 2 mutating self-return methods and one build-step method.
 */
std::vector<BuilderStructureCheckResult> check_builder_pattern_structure(const ParseTreeNode& parse_root);

/**
 * @brief Analyze classes for builder-style setup:
 * multiple methods containing assignments and member assignments (obj->attribute = ...).
 */
CreationalTreeNode build_builder_pattern_tree(const ParseTreeNode& parse_root);
const ICreationalPatternAlgorithm& builder_pattern_algorithm();

#endif // BUILDER_PATTERN_LOGIC_HPP
