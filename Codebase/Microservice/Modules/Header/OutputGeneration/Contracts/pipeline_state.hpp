#pragma once

#include "Analysis/Input/source_reader.hpp"
#include "Analysis/Lexical/token_stream.hpp"
#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/Patterns/Catalog/catalog.hpp"
#include "Analysis/Patterns/Catalog/matcher.hpp"
#include "HashingMechanism/HashLinks/hash_links.hpp"
#include "OutputGeneration/Contracts/algorithm_pipeline.hpp"
#include "OutputGeneration/Contracts/analysis_context.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <chrono>
#include <string>
#include <vector>

struct SourcePipelineState
{
    ParseTreeBuildContext              build_context;
    std::vector<SourceFileUnit>        source_files;

    ParseTreeNode                      main_tree;
    std::vector<ParseTreeNode>         per_file_roots;
    std::vector<LineHashTrace>         line_traces;
    std::vector<FactoryInvocationTrace> factory_invocations;

    std::vector<ClassTokenStream>      class_token_streams;
    ParseTreeSymbolTables              symbol_tables;

    PatternCatalog                     pattern_catalog;
    std::vector<PatternMatchResult>    pattern_matches;

    HashLinkIndex                      hash_links;

    PipelineReport                     report;
};

void run_analysis_stage(SourcePipelineState& state);

void run_trees_stage(SourcePipelineState& state);

void run_pattern_dispatch_stage(SourcePipelineState& state);

void run_hashing_stage(SourcePipelineState& state);

void run_diffing_stage(SourcePipelineState& state);

void run_output_stage(SourcePipelineState& state);
