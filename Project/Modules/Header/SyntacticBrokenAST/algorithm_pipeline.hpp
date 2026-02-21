#ifndef ALGORITHM_PIPELINE_HPP
#define ALGORITHM_PIPELINE_HPP

#include "behavioural_broken_tree.hpp"
#include "creational_broken_tree.hpp"
#include "parse_tree.hpp"
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
    bool graph_consistent;
};

struct PipelineArtifacts
{
    ParseTreeNode base_tree;
    ParseTreeNode behavioural_tree;
    CreationalTreeNode creational_tree;
    ParseTreeNode virtual_tree;
    std::string monolithic_representation;
    PipelineReport report;
};

PipelineArtifacts run_normalize_and_rewrite_pipeline(
    const std::vector<SourceFileUnit>& source_files,
    const std::string& source_pattern,
    const std::string& target_pattern,
    size_t input_file_count,
    const std::vector<std::string>& input_files);
std::string pipeline_report_to_json(const PipelineReport& report);

#endif // ALGORITHM_PIPELINE_HPP
