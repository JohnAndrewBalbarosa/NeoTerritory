#include "algorithm_pipeline.hpp"

#include "parse_tree_symbols.hpp"

#include <algorithm>
#include <chrono>
#include <sstream>
#include <string>

namespace
{
using Clock = std::chrono::steady_clock;

size_t estimate_parse_tree_bytes(const ParseTreeNode& node)
{
    size_t total = sizeof(ParseTreeNode) + node.kind.size() + node.value.size();
    total += node.children.capacity() * sizeof(ParseTreeNode);

    for (const ParseTreeNode& child : node.children)
    {
        total += estimate_parse_tree_bytes(child);
    }

    return total;
}

size_t estimate_creational_tree_bytes(const CreationalTreeNode& node)
{
    size_t total = sizeof(CreationalTreeNode) + node.kind.size() + node.label.size();
    total += node.children.capacity() * sizeof(CreationalTreeNode);

    for (const CreationalTreeNode& child : node.children)
    {
        total += estimate_creational_tree_bytes(child);
    }

    return total;
}

size_t estimate_symbol_table_bytes()
{
    size_t total = 0;

    const std::vector<ParseSymbol>& classes = getClassSymbolTable();
    const std::vector<ParseSymbol>& functions = getFunctionSymbolTable();

    total += classes.capacity() * sizeof(ParseSymbol);
    total += functions.capacity() * sizeof(ParseSymbol);

    for (const ParseSymbol& s : classes)
    {
        total += s.name.size() + s.signature.size();
    }
    for (const ParseSymbol& s : functions)
    {
        total += s.name.size() + s.signature.size();
    }

    return total;
}

std::string json_escape(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        switch (c)
        {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(c); break;
        }
    }
    return out;
}
} // namespace

PipelineArtifacts run_normalize_and_rewrite_pipeline(
    const std::vector<SourceFileUnit>& source_files,
    const std::string& source_pattern,
    const std::string& target_pattern,
    size_t input_file_count,
    const std::vector<std::string>& input_files)
{
    PipelineArtifacts artifacts;
    artifacts.report.source_pattern = source_pattern;
    artifacts.report.target_pattern = target_pattern;
    artifacts.report.input_file_count = input_file_count;
    artifacts.report.total_elapsed_ms = 0.0;
    artifacts.report.peak_estimated_bytes = 0;
    artifacts.report.graph_consistent = false;

    const Clock::time_point pipeline_begin = Clock::now();

    auto run_stage = [&](const std::string& name, auto&& fn) {
        const Clock::time_point begin = Clock::now();
        const size_t bytes = fn();
        const Clock::time_point end = Clock::now();

        StageMetric m;
        m.name = name;
        m.elapsed_ms = std::chrono::duration<double, std::milli>(end - begin).count();
        m.estimated_bytes = bytes;
        artifacts.report.stages.push_back(std::move(m));
        artifacts.report.peak_estimated_bytes = std::max(artifacts.report.peak_estimated_bytes, bytes);
    };

    // 1) Input parse -> base graph
    run_stage("ParseBaseGraph", [&]() {
        ParseTreeBuildContext context;
        context.source_pattern = source_pattern;
        context.target_pattern = target_pattern;
        context.input_files = input_files;
        set_parse_tree_build_context(context);
        const ParseTreeBundle trees = build_cpp_parse_trees(source_files);
        artifacts.base_tree = trees.main_tree;
        artifacts.virtual_tree = trees.shadow_tree;
        return estimate_parse_tree_bytes(artifacts.base_tree) +
               estimate_parse_tree_bytes(artifacts.virtual_tree) +
               estimate_symbol_table_bytes();
    });

    // 2) Detect patterns
    run_stage("DetectPatternInstances", [&]() {
        artifacts.creational_tree = build_creational_broken_tree(artifacts.base_tree);
        artifacts.behavioural_tree = build_behavioural_broken_tree(artifacts.base_tree);
        return estimate_creational_tree_bytes(artifacts.creational_tree) +
               estimate_parse_tree_bytes(artifacts.behavioural_tree);
    });

    // 3) Create virtual subgraph
    run_stage("CreateVirtualSubgraph", [&]() {
        // Shadow AST is built during lexical parsing to preserve scope-local usage context.
        return estimate_parse_tree_bytes(artifacts.virtual_tree);
    });

    // 4) Hash affected nodes (symbol tables)
    run_stage("HashAffectedNodes", [&]() {
        rebuild_parse_tree_symbol_tables(artifacts.base_tree);
        return estimate_symbol_table_bytes();
    });

    // 5) Generate monolithic representation
    run_stage("GenerateMonolithicRepresentation", [&]() {
        artifacts.monolithic_representation = parse_tree_to_text(artifacts.virtual_tree);
        return artifacts.monolithic_representation.size();
    });

    // 6) Apply target policies (scaffold/no-op)
    run_stage("ApplyTargetPolicies", [&]() {
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    // 7) Validate consistency
    run_stage("ValidateGraphConsistency", [&]() {
        artifacts.report.graph_consistent =
            !artifacts.base_tree.kind.empty() &&
            !artifacts.virtual_tree.kind.empty() &&
            (!artifacts.monolithic_representation.empty());
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    const Clock::time_point pipeline_end = Clock::now();
    artifacts.report.total_elapsed_ms =
        std::chrono::duration<double, std::milli>(pipeline_end - pipeline_begin).count();

    return artifacts;
}

std::string pipeline_report_to_json(const PipelineReport& report)
{
    std::ostringstream out;
    out << "{\n";
    out << "  \"source_pattern\": \"" << json_escape(report.source_pattern) << "\",\n";
    out << "  \"target_pattern\": \"" << json_escape(report.target_pattern) << "\",\n";
    out << "  \"input_file_count\": " << report.input_file_count << ",\n";
    out << "  \"total_elapsed_ms\": " << report.total_elapsed_ms << ",\n";
    out << "  \"peak_estimated_bytes\": " << report.peak_estimated_bytes << ",\n";
    out << "  \"graph_consistent\": " << (report.graph_consistent ? "true" : "false") << ",\n";
    out << "  \"class_registry\": [\n";

    const std::vector<ParseSymbol>& class_symbols = getClassSymbolTable();
    for (size_t i = 0; i < class_symbols.size(); ++i)
    {
        const ParseSymbol& s = class_symbols[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"file_path\": \"" << json_escape(s.file_path) << "\",\n";
        out << "      \"name_hash\": " << s.name_hash << ",\n";
        out << "      \"contextual_hash\": " << s.contextual_hash << ",\n";
        out << "      \"hash\": " << s.hash_value << ",\n";
        out << "      \"definition_node_index\": " << s.definition_node_index << "\n";
        out << "    }";
        if (i + 1 < class_symbols.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"class_usages\": [\n";

    const std::vector<ParseSymbolUsage>& class_usages = getClassUsageTable();
    for (size_t i = 0; i < class_usages.size(); ++i)
    {
        const ParseSymbolUsage& u = class_usages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(u.name) << "\",\n";
        out << "      \"type_string\": \"" << json_escape(u.type_string) << "\",\n";
        out << "      \"node_kind\": \"" << json_escape(u.node_kind) << "\",\n";
        out << "      \"node_value\": \"" << json_escape(u.node_value) << "\",\n";
        out << "      \"node_index\": " << u.node_index << ",\n";
        out << "      \"node_contextual_hash\": " << u.node_contextual_hash << ",\n";
        out << "      \"class_name_hash\": " << u.class_name_hash << ",\n";
        out << "      \"hash_collision\": " << (u.hash_collision ? "true" : "false") << ",\n";
        out << "      \"refactor_candidate\": " << (u.refactor_candidate ? "true" : "false") << ",\n";
        out << "      \"hash\": " << u.hash_value << "\n";
        out << "    }";
        if (i + 1 < class_usages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"line_hash_traces\": [\n";

    const std::vector<LineHashTrace>& traces = get_line_hash_traces();
    for (size_t i = 0; i < traces.size(); ++i)
    {
        const LineHashTrace& t = traces[i];
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(t.file_path) << "\",\n";
        out << "      \"line_number\": " << t.line_number << ",\n";
        out << "      \"class_name\": \"" << json_escape(t.class_name) << "\",\n";
        out << "      \"class_name_hash\": " << t.class_name_hash << ",\n";
        out << "      \"matched_class_contextual_hash\": " << t.matched_class_contextual_hash << ",\n";
        out << "      \"hit_token_index\": " << t.hit_token_index << ",\n";
        out << "      \"outgoing_hash\": " << t.outgoing_hash << ",\n";
        out << "      \"dirty_token_count\": " << t.dirty_token_count << ",\n";
        out << "      \"hash_collision\": " << (t.hash_collision ? "true" : "false") << "\n";
        out << "    }";
        if (i + 1 < traces.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"stages\": [\n";

    for (size_t i = 0; i < report.stages.size(); ++i)
    {
        const StageMetric& s = report.stages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"elapsed_ms\": " << s.elapsed_ms << ",\n";
        out << "      \"estimated_bytes\": " << s.estimated_bytes << "\n";
        out << "    }";
        if (i + 1 < report.stages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ]\n";
    out << "}\n";
    return out.str();
}
