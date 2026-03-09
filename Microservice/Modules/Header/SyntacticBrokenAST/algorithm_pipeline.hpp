#ifndef ALGORITHM_PIPELINE_HPP
#define ALGORITHM_PIPELINE_HPP

#include "behavioural_broken_tree.hpp"
#include "creational_broken_tree.hpp"
#include "parse_tree.hpp"
#include "parse_tree_code_generator.hpp"
#include "parse_tree_hash_links.hpp"
#include "parse_tree_symbols.hpp"
#include "source_reader.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct StageMetric
{
    std::string name;
    double elapsed_ms;
    size_t estimated_bytes;
};

struct PipelineReport
{
    std::vector<StageMetric> stages;
    std::string source_pattern;
    std::string target_pattern;
    size_t input_file_count;
    double total_elapsed_ms;
    size_t peak_estimated_bytes;
    size_t expected_file_pair_count;
    size_t paired_file_count;
    size_t invariant_failure_count;
    size_t dirty_trace_count;
    size_t intentional_collision_total;
    size_t intentional_collision_validated;
    bool graph_consistent;
    std::vector<std::string> invariant_failures;
};

struct PipelineArtifacts
{
    ParseTreeNode base_tree;
    ParseTreeNode behavioural_tree;
    CreationalTreeNode creational_tree;
    ParseTreeNode virtual_tree;
    HashLinkIndex hash_links;
    std::vector<LineHashTrace> line_hash_traces;
    std::vector<FactoryInvocationTrace> factory_invocation_traces;
    std::vector<CrucialClassInfo> crucial_classes;
    ParseTreeSymbolTables symbol_tables;
    std::string monolithic_representation;
    PipelineReport report;
};

PipelineArtifacts run_normalize_and_rewrite_pipeline(
    const std::vector<SourceFileUnit>& source_files,
    const std::string& source_pattern,
    const std::string& target_pattern,
    size_t input_file_count,
    const std::vector<std::string>& input_files);
std::string pipeline_report_to_json(
    const PipelineReport& report,
    const ParseTreeSymbolTables& symbol_tables,
    const std::vector<LineHashTrace>& line_hash_traces,
    const std::vector<FactoryInvocationTrace>& factory_invocation_traces,
    const HashLinkIndex& hash_links,
    const std::vector<TransformDecision>& transform_decisions = {});

#endif // ALGORITHM_PIPELINE_HPP
