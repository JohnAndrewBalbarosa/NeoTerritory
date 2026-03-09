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
    size_t class_name_hash = 0;
    size_t matched_class_contextual_hash = 0;
    size_t scope_hash = 0;
    size_t scoped_class_usage_hash = 0;
    size_t hit_token_index = 0;
    size_t outgoing_hash = 0;
    size_t dirty_token_count = 0;
    bool hash_collision = false;
    bool intentional_scope_collision = false;
    std::vector<size_t> hash_chain;
};

struct FactoryInvocationTrace
{
    std::string file_path;
    size_t line_number = 0;
    std::string invocation_form;
    std::string receiver_token;
    std::string resolved_factory_class;
    std::string argument_token;
    std::string argument_hash_id;
    size_t scope_context_hash = 0;
};

struct ParseTreeBundle
{
    ParseTreeNode main_tree;
    ParseTreeNode shadow_tree;
    std::vector<LineHashTrace> line_hash_traces;
    std::vector<FactoryInvocationTrace> factory_invocation_traces;
    std::vector<CrucialClassInfo> crucial_classes;
    size_t virtual_nodes_kept = 0;
    size_t virtual_nodes_pruned = 0;
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
