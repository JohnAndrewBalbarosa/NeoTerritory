#include "source_reader.hpp"
#include "algorithm_pipeline.hpp"
#include "cli_arguments.hpp"
#include "codebase_output_writer.hpp"
#include "lexical_structure_hooks.hpp"
#include "parse_tree.hpp"
#include "parse_tree_code_generator.hpp"
#include "parse_tree_symbols.hpp"
#include "creational_broken_tree.hpp"
#include "behavioural_broken_tree.hpp"

#include <fstream>
#include <iostream>
#include <string>

namespace
{
bool write_text_file(const std::string& path, const std::string& content)
{
    std::ofstream out(path);
    if (!out)
    {
        return false;
    }
    out << content;
    return true;
}
} // namespace

int run_syntactic_broken_ast(int argc, char* argv[])
{
    CliArguments cli;
    std::string cli_error;
    if (!parse_cli_arguments(argc, argv, cli, cli_error))
    {
        std::cerr << cli_error << '\n';
        return 1;
    }

    const std::vector<SourceFileUnit> source_files = read_source_file_units(cli.input_files);
    if (source_files.empty())
    {
        std::cerr << "No source provided.\n";
        return 1;
    }

    const PipelineArtifacts artifacts =
        run_normalize_and_rewrite_pipeline(
            source_files,
            cli.source_pattern,
            cli.target_pattern,
            cli.input_files.size(),
            cli.input_files);
    const ParseTreeNode& tree = artifacts.base_tree;
    const ParseTreeNode& shadow_tree = artifacts.virtual_tree;

    std::cout << "\n=== C++ Parse Tree ===\n";
    std::cout << parse_tree_to_text(tree);

    std::cout << "\n=== Shadow AST (Virtual Tree) ===\n";
    std::cout << parse_tree_to_text(shadow_tree);

    const std::string parse_tree_output_path = "parse_tree.html";
    if (!write_text_file(parse_tree_output_path, parse_tree_to_html(tree)))
    {
        std::cerr << "Failed to write " << parse_tree_output_path << '\n';
        return 1;
    }

    const CreationalTreeNode& creational_tree = artifacts.creational_tree;

    std::cout << "\n=== Creational Broken Tree ===\n";
    std::cout << creational_tree_to_text(creational_tree);

    const std::string creational_output_path = "creational_parse_tree.html";
    if (!write_text_file(creational_output_path, creational_tree_to_html(creational_tree)))
    {
        std::cerr << "Failed to write " << creational_output_path << '\n';
        return 1;
    }

    const ParseTreeNode& behavioural_tree = artifacts.behavioural_tree;

    std::cout << "\n=== Behavioural Broken Tree ===\n";
    std::cout << parse_tree_to_text(behavioural_tree);

    const std::string behavioural_output_path = "behavioural_broken_ast.html";
    if (!write_text_file(behavioural_output_path, behavioural_broken_tree_to_html(behavioural_tree)))
    {
        std::cerr << "Failed to write " << behavioural_output_path << '\n';
        return 1;
    }

    std::cout << "\nHTML parse tree generated: " << parse_tree_output_path << '\n';
    std::cout << "Creational HTML generated: " << creational_output_path << '\n';
    std::cout << "Behavioural HTML generated: " << behavioural_output_path << '\n';

    const std::string merged_source = join_source_file_units(source_files);
    const std::string base_code = generate_base_code_from_source(merged_source);
    const std::string target_code =
        generate_target_code_from_source(merged_source, cli.source_pattern, cli.target_pattern);

    std::cout << "\n=== Generated Base Code ===\n";
    std::cout << base_code << '\n';

    CodebaseOutputPaths code_paths;
    if (!write_codebase_outputs(base_code, target_code, cli.target_pattern, code_paths))
    {
        std::cerr << "Failed to write generated base/target code outputs.\n";
        return 1;
    }

    std::cout << "Generated base code cpp: " << code_paths.base_cpp_path << '\n';
    std::cout << "Generated target code cpp: " << code_paths.target_cpp_path << '\n';
    std::cout << "Generated base code html: " << code_paths.base_html_path << '\n';
    std::cout << "Generated target code html: " << code_paths.target_html_path << '\n';

    std::cout << "\n=== Performance Report ===\n";
    std::cout << "Source pattern: " << artifacts.report.source_pattern << '\n';
    std::cout << "Target pattern: " << artifacts.report.target_pattern << '\n';
    std::cout << "Input files: " << artifacts.report.input_file_count << '\n';
    std::cout << "Total elapsed (ms): " << artifacts.report.total_elapsed_ms << '\n';
    std::cout << "Peak estimated memory (bytes): " << artifacts.report.peak_estimated_bytes << '\n';
    std::cout << "Graph consistent: " << (artifacts.report.graph_consistent ? "true" : "false") << '\n';
    for (const StageMetric& s : artifacts.report.stages)
    {
        std::cout << " - " << s.name
                  << " | elapsed_ms=" << s.elapsed_ms
                  << " | estimated_bytes=" << s.estimated_bytes << '\n';
    }

    std::cout << "\n=== Class Usage Hashes ===\n";
    std::cout << "Crucial classes selected by strategy:\n";
    for (const CrucialClassInfo& info : get_crucial_class_registry())
    {
        std::cout << " - class=" << info.name
                  << " | class_name_hash=" << info.class_name_hash
                  << " | strategy=" << info.strategy_name << '\n';
    }

    for (const ParseSymbol& cls : getClassSymbolTable())
    {
        std::cout << " - class_def=" << cls.name
                  << " | class_name_hash=" << cls.name_hash
                  << " | contextual_hash=" << cls.contextual_hash
                  << " | scoped_hash=" << cls.hash_value
                  << " | definition_node_index=" << cls.definition_node_index << '\n';
    }
    for (const ParseSymbolUsage& usage : getClassUsageTable())
    {
        std::cout << " - class=" << usage.name
                  << " | type=" << usage.type_string
                  << " | node_index=" << usage.node_index
                  << " | node_contextual_hash=" << usage.node_contextual_hash
                  << " | class_name_hash=" << usage.class_name_hash
                  << " | scoped_usage_hash=" << usage.hash_value
                  << " | hash_collision=" << (usage.hash_collision ? "true" : "false")
                  << " | refactor_candidate=" << (usage.refactor_candidate ? "true" : "false")
                  << " | node_kind=" << usage.node_kind << '\n';
    }

    std::cout << "\n=== Line Hash Traces ===\n";
    for (const LineHashTrace& trace : get_line_hash_traces())
    {
        std::cout << " - line=" << trace.line_number
                  << " | class=" << trace.class_name
                  << " | class_hash=" << trace.class_name_hash
                  << " | hit_token_index=" << trace.hit_token_index
                  << " | outgoing_hash=" << trace.outgoing_hash
                  << " | dirty_tokens=" << trace.dirty_token_count
                  << " | collision=" << (trace.hash_collision ? "true" : "false")
                  << '\n';
    }

    const std::string report_output_path = "analysis_report.json";
    if (!write_text_file(report_output_path, pipeline_report_to_json(artifacts.report)))
    {
        std::cerr << "Failed to write " << report_output_path << '\n';
        return 1;
    }
    std::cout << "Performance JSON report generated: " << report_output_path << '\n';

    return 0;
}
