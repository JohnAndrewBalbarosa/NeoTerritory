#ifndef PARSE_TREE_HPP
#define PARSE_TREE_HPP

#include "analysis_context.hpp"
#include "lexical_structure_hooks.hpp"
#include "source_reader.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode
{
    std::string kind;
    std::string value;
    std::vector<ParseTreeNode> children;
    size_t contextual_hash = 0;
    std::vector<size_t> propagated_usage_hashes;
    std::string annotated_value;
};

struct LineHashTrace
{
    std::string file_path;
    size_t line_number;
    std::string class_name;
    size_t class_name_hash;
    size_t matched_class_contextual_hash;
    size_t hit_token_index;
    size_t outgoing_hash;
    size_t dirty_token_count;
    bool hash_collision;
    std::vector<size_t> hash_chain;
};

struct ParseTreeBundle
{
    ParseTreeNode main_tree;
    ParseTreeNode shadow_tree;
    std::vector<LineHashTrace> line_hash_traces;
    std::vector<CrucialClassInfo> crucial_classes;
};

/**
 * @brief Parse C++ source code into a lightweight hierarchical parse tree.
 */
ParseTreeNode build_cpp_parse_tree(
    const std::string& source,
    const ParseTreeBuildContext& context = ParseTreeBuildContext{});
ParseTreeNode build_cpp_parse_tree(
    const std::vector<SourceFileUnit>& files,
    const ParseTreeBuildContext& context = ParseTreeBuildContext{});
ParseTreeBundle build_cpp_parse_trees(
    const std::vector<SourceFileUnit>& files,
    const ParseTreeBuildContext& context);

/**
 * @brief Render parse tree as indented text for terminal output.
 */
std::string parse_tree_to_text(const ParseTreeNode& root);
std::string parse_tree_to_html(const ParseTreeNode& root);

#endif // PARSE_TREE_HPP
