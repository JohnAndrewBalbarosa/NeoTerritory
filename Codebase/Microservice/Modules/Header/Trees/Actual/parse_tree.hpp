#pragma once

#include "OutputGeneration/Contracts/analysis_context.hpp"
#include "Analysis/Lexical/lexical_structure_hooks.hpp"
#include "Analysis/Input/source_reader.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode
{
    std::string                kind;
    std::string                name;
    std::string                text;
    std::size_t                hash        = 0;
    std::size_t                parent_hash = 0;
    std::string                file_name;
    std::size_t                line        = 0;
    std::size_t                column      = 0;
    std::vector<ParseTreeNode> children;
};

struct LineHashTrace
{
    std::string file_name;
    std::size_t line_number = 0;
    std::size_t line_hash   = 0;
    std::string text;
};

struct FactoryInvocationTrace
{
    std::string factory_class_name;
    std::string kind_value;
    std::string created_class_name;
    std::size_t line_number = 0;
    std::string file_name;
};

struct ParseTreeBundle
{
    std::vector<ParseTreeNode>          per_file_roots;
    std::vector<LineHashTrace>          line_traces;
    std::vector<FactoryInvocationTrace> factory_invocations;
};

ParseTreeNode build_cpp_parse_tree(
    const SourceFileUnit&        source,
    const ParseTreeBuildContext& context);

ParseTreeBundle build_cpp_parse_trees(
    const std::vector<SourceFileUnit>& sources,
    const ParseTreeBuildContext&       context);

std::string parse_tree_to_text(const ParseTreeNode& root);

std::string parse_tree_to_html(const ParseTreeNode& root);
