#ifndef PARSE_TREE_HPP
#define PARSE_TREE_HPP

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

struct ParseTreeBuildContext
{
    std::string source_pattern;
    std::string target_pattern;
    std::vector<std::string> input_files;
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
};

void set_parse_tree_build_context(const ParseTreeBuildContext& context);
const ParseTreeBuildContext& get_parse_tree_build_context();
const std::vector<LineHashTrace>& get_line_hash_traces();

/**
 * @brief Parse C++ source code into a lightweight hierarchical parse tree.
 */
ParseTreeNode build_cpp_parse_tree(const std::string& source);
ParseTreeNode build_cpp_parse_tree(const std::vector<SourceFileUnit>& files);
ParseTreeBundle build_cpp_parse_trees(const std::vector<SourceFileUnit>& files);

/**
 * @brief Render parse tree as indented text for terminal output.
 */
std::string parse_tree_to_text(const ParseTreeNode& root);
std::string parse_tree_to_html(const ParseTreeNode& root);

#endif // PARSE_TREE_HPP
