#ifndef PARSE_TREE_CODE_GENERATOR_HPP
#define PARSE_TREE_CODE_GENERATOR_HPP

#include "parse_tree.hpp"

#include <string>

std::string generate_base_code_from_source(const std::string& source);
std::string generate_target_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

#endif // PARSE_TREE_CODE_GENERATOR_HPP
