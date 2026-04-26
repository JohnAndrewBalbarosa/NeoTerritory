#pragma once

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode;

struct StageMetric
{
    std::string stage_name;
    std::size_t milliseconds      = 0;
    std::size_t items_processed   = 0;
};

struct DocumentationTarget
{
    std::string label;
    std::size_t node_hash   = 0;
    std::size_t line        = 0;
    std::size_t column      = 0;
    std::string lexeme;
};

struct UnitTestTarget
{
    std::size_t containing_class_hash = 0;
    std::size_t function_hash         = 0;
    std::string function_name;
    std::string file_name;
    std::size_t line                  = 0;
    std::string branch_kind;
};

struct DesignPatternTag
{
    std::string                       pattern_family;
    std::string                       pattern_name;
    std::string                       pattern_id;
    std::size_t                       target_class_hash = 0;
    std::vector<DocumentationTarget>  documentation_targets;
    std::vector<UnitTestTarget>       unit_test_targets;
};

struct PipelineArtifacts
{
    std::string                  output_root;
    std::vector<std::string>     written_files;
    std::vector<DesignPatternTag> tags;
};

struct PipelineReport
{
    std::vector<StageMetric>      stage_metrics;
    std::vector<DesignPatternTag> detected_patterns;
    std::size_t                   documentation_target_count = 0;
    std::size_t                   unit_test_target_count     = 0;
    std::vector<std::string>      diagnostics;
    PipelineArtifacts             artifacts;
};

PipelineReport run_normalize_and_rewrite_pipeline(
    const std::vector<std::string>& input_paths,
    const std::string&              output_path,
    const std::string&              catalog_path = {});

std::string pipeline_report_to_json(const PipelineReport& report);
