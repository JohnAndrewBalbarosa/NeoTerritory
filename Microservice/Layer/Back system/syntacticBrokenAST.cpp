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

#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace
{
const std::string k_input_dir_name = "Input";
const std::string k_output_dir_name = "Output";
const std::string k_generated_code_dir_name = "generated_code";
const std::string k_generated_html_dir_name = "html";
const std::string k_analysis_report_dir_name = "analysis_report";

enum class RunExitCode
{
    Success = 0,
    InvalidCliArguments = 2,
    InputResolutionFailure = 3,
    SourceReadFailure = 4,
    OutputPreparationFailure = 5,
    ParseTreeOutputFailure = 6,
    CodeOutputFailure = 7,
    ReportOutputFailure = 8
};

struct RuntimeLayout
{
    std::filesystem::path exe_dir;
    std::filesystem::path input_dir;
    std::filesystem::path output_dir;
    std::filesystem::path generated_code_dir;
    std::filesystem::path generated_html_dir;
    std::filesystem::path analysis_report_dir;
};

std::string supported_extensions_text()
{
    return ".cpp, .hpp, .h, .cc, .cxx";
}

void print_error_diagnostics(
    const std::string& title,
    const std::vector<std::string>& details,
    const std::vector<std::string>& fixes)
{
    std::cerr << "\n[NeoTerritory] " << title << '\n';
    for (const std::string& line : details)
    {
        std::cerr << "  - " << line << '\n';
    }

    if (!fixes.empty())
    {
        std::cerr << "How to fix:\n";
        for (const std::string& line : fixes)
        {
            std::cerr << "  - " << line << '\n';
        }
    }
}

std::filesystem::path get_executable_dir(const char* argv0)
{
    if (argv0 == nullptr || *argv0 == '\0')
    {
        return std::filesystem::current_path();
    }

    std::error_code ec;
    const std::filesystem::path exe_path = std::filesystem::absolute(argv0, ec);
    if (!ec && exe_path.has_parent_path())
    {
        return exe_path.parent_path();
    }
    return std::filesystem::current_path();
}

bool ensure_directory(const std::filesystem::path& dir)
{
    std::error_code ec;
    std::filesystem::create_directories(dir, ec);
    return std::filesystem::exists(dir) && std::filesystem::is_directory(dir);
}

bool has_supported_extension(const std::filesystem::path& path)
{
    const std::string ext = path.extension().string();
    return ext == ".cpp" || ext == ".hpp" || ext == ".h" || ext == ".cc" || ext == ".cxx";
}

std::vector<std::string> discover_input_files(const std::filesystem::path& input_dir)
{
    std::vector<std::string> files;
    if (!std::filesystem::exists(input_dir) || !std::filesystem::is_directory(input_dir))
    {
        return files;
    }

    for (const auto& entry : std::filesystem::directory_iterator(input_dir))
    {
        if (!entry.is_regular_file())
        {
            continue;
        }
        if (!has_supported_extension(entry.path()))
        {
            continue;
        }
        files.push_back(entry.path().string());
    }

    return files;
}

RuntimeLayout resolve_runtime_layout(const char* argv0)
{
    RuntimeLayout layout;
    layout.exe_dir = get_executable_dir(argv0);
    layout.input_dir = layout.exe_dir / k_input_dir_name;
    layout.output_dir = layout.exe_dir / k_output_dir_name;
    layout.generated_code_dir = layout.output_dir / k_generated_code_dir_name;
    layout.generated_html_dir = layout.output_dir / k_generated_html_dir_name;
    layout.analysis_report_dir = layout.output_dir / k_analysis_report_dir_name;
    return layout;
}

bool ensure_runtime_layout(const RuntimeLayout& layout, std::string& error_path)
{
    const std::vector<std::filesystem::path> required_dirs = {
        layout.input_dir,
        layout.output_dir,
        layout.generated_code_dir,
        layout.generated_html_dir,
        layout.analysis_report_dir,
    };

    for (const std::filesystem::path& dir : required_dirs)
    {
        if (!ensure_directory(dir))
        {
            error_path = dir.string();
            return false;
        }
    }

    return true;
}

bool write_text_file(const std::string& path, const std::string& content)
{
    const std::filesystem::path out_path(path);
    if (out_path.has_parent_path())
    {
        std::error_code ec;
        std::filesystem::create_directories(out_path.parent_path(), ec);
        if (ec && !std::filesystem::exists(out_path.parent_path()))
        {
            return false;
        }
    }

    std::ofstream out(out_path);
    if (!out)
    {
        return false;
    }
    out << content;
    return true;
}

bool write_tree_outputs(
    const std::filesystem::path& generated_html_dir,
    const ParseTreeNode& base_tree,
    const CreationalTreeNode& creational_tree,
    const ParseTreeNode& behavioural_tree,
    std::string& parse_tree_output_path,
    std::string& creational_output_path,
    std::string& behavioural_output_path)
{
    parse_tree_output_path = (generated_html_dir / "parse_tree.html").string();
    creational_output_path = (generated_html_dir / "creational_parse_tree.html").string();
    behavioural_output_path = (generated_html_dir / "behavioural_broken_ast.html").string();

    if (!write_text_file(parse_tree_output_path, parse_tree_to_html(base_tree)))
    {
        return false;
    }
    if (!write_text_file(creational_output_path, creational_tree_to_html(creational_tree)))
    {
        return false;
    }
    if (!write_text_file(behavioural_output_path, behavioural_broken_tree_to_html(behavioural_tree)))
    {
        return false;
    }

    return true;
}

void print_performance_report(const PipelineReport& report)
{
    std::cout << "\n=== Performance Report ===\n";
    std::cout << "Source pattern: " << report.source_pattern << '\n';
    std::cout << "Target pattern: " << report.target_pattern << '\n';
    std::cout << "Input files: " << report.input_file_count << '\n';
    std::cout << "Total elapsed (ms): " << report.total_elapsed_ms << '\n';
    std::cout << "Peak estimated memory (bytes): " << report.peak_estimated_bytes << '\n';
    std::cout << "Graph consistent: " << (report.graph_consistent ? "true" : "false") << '\n';
    for (const StageMetric& s : report.stages)
    {
        std::cout << " - " << s.name
                  << " | elapsed_ms=" << s.elapsed_ms
                  << " | estimated_bytes=" << s.estimated_bytes << '\n';
    }
}

void print_symbol_diagnostics(const PipelineArtifacts& artifacts)
{
    std::cout << "\n=== Class Usage Hashes ===\n";
    std::cout << "Crucial classes selected by strategy:\n";
    for (const CrucialClassInfo& info : artifacts.crucial_classes)
    {
        std::cout << " - class=" << info.name
                  << " | class_name_hash=" << info.class_name_hash
                  << " | strategy=" << info.strategy_name << '\n';
    }

    for (const ParseSymbol& cls : class_symbol_table(artifacts.symbol_tables))
    {
        std::cout << " - class_def=" << cls.name
                  << " | file=" << cls.file_path
                  << " | class_name_hash=" << cls.name_hash
                  << " | contextual_hash=" << cls.contextual_hash
                  << " | scoped_hash=" << cls.hash_value
                  << " | definition_node_index=" << cls.definition_node_index << '\n';
    }
    for (const ParseSymbolUsage& usage : class_usage_table(artifacts.symbol_tables))
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
    for (const LineHashTrace& trace : artifacts.line_hash_traces)
    {
        std::cout << " - line=" << trace.line_number
                  << " | file=" << trace.file_path
                  << " | class=" << trace.class_name
                  << " | class_hash=" << trace.class_name_hash
                  << " | matched_class_ctx_hash=" << trace.matched_class_contextual_hash
                  << " | hit_token_index=" << trace.hit_token_index
                  << " | outgoing_hash=" << trace.outgoing_hash
                  << " | dirty_tokens=" << trace.dirty_token_count
                  << " | collision=" << (trace.hash_collision ? "true" : "false")
                  << '\n';
    }
}
} // namespace

int run_syntactic_broken_ast(int argc, char* argv[])
{
    const char* argv0 = (argv != nullptr && argc > 0) ? argv[0] : nullptr;
    const RuntimeLayout layout = resolve_runtime_layout(argv0);

    CliArguments cli;
    std::string cli_error;
    if (!parse_cli_arguments(argc, argv, cli, cli_error))
    {
        print_error_diagnostics(
            "Invalid CLI arguments.",
            {cli_error},
            {
                "Usage: NeoTerritory <source_pattern> <target_pattern>",
                "Folder-only input mode: files are discovered from " + layout.input_dir.string(),
            });
        return static_cast<int>(RunExitCode::InvalidCliArguments);
    }

    std::string layout_prepare_failed_path;
    if (!ensure_runtime_layout(layout, layout_prepare_failed_path))
    {
        print_error_diagnostics(
            "Failed to prepare runtime layout directories.",
            {"Directory: " + layout_prepare_failed_path},
            {
                "Check directory permissions and ensure the path is writable.",
                "Expected runtime layout root: " + layout.exe_dir.string(),
            });
        return static_cast<int>(RunExitCode::OutputPreparationFailure);
    }

    const std::vector<std::string> discovered_files = discover_input_files(layout.input_dir);
    if (discovered_files.empty())
    {
        print_error_diagnostics(
            "No source files found.",
            {
                "Input folder: " + layout.input_dir.string(),
                "Supported extensions: " + supported_extensions_text(),
            },
            {
                "Add source files directly inside: " + layout.input_dir.string(),
                "Folder scan is top-level only (subfolders are not scanned).",
            });
        return static_cast<int>(RunExitCode::InputResolutionFailure);
    }

    std::cout << "Input directory: " << layout.input_dir << '\n';
    std::cout << "Discovered files:\n";
    for (const std::string& path : discovered_files)
    {
        std::cout << " - " << path << '\n';
    }

    cli.input_files = discovered_files;

    const std::vector<SourceFileUnit> source_files = read_source_file_units(cli.input_files);
    if (source_files.empty())
    {
        print_error_diagnostics(
            "Failed to read source files.",
            {"One or more files could not be opened/read."},
            {"Verify each file exists and is readable."});
        return static_cast<int>(RunExitCode::SourceReadFailure);
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

    const CreationalTreeNode& creational_tree = artifacts.creational_tree;

    std::cout << "\n=== Creational Broken Tree ===\n";
    std::cout << creational_tree_to_text(creational_tree);

    const ParseTreeNode& behavioural_tree = artifacts.behavioural_tree;

    std::cout << "\n=== Behavioural Broken Tree ===\n";
    std::cout << parse_tree_to_text(behavioural_tree);

    std::string parse_tree_output_path;
    std::string creational_output_path;
    std::string behavioural_output_path;
    if (!write_tree_outputs(
            layout.generated_html_dir,
            tree,
            creational_tree,
            behavioural_tree,
            parse_tree_output_path,
            creational_output_path,
            behavioural_output_path))
    {
        print_error_diagnostics(
            "Failed to write parse-tree HTML outputs.",
            {"Target directory: " + layout.generated_html_dir.string()},
            {"Check directory permissions and available disk space."});
        return static_cast<int>(RunExitCode::ParseTreeOutputFailure);
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
    if (!write_codebase_outputs(
            base_code,
            target_code,
            cli.target_pattern,
            layout.generated_code_dir.string(),
            layout.generated_html_dir.string(),
            code_paths))
    {
        print_error_diagnostics(
            "Failed to write generated base/target outputs.",
            {"Code dir: " + layout.generated_code_dir.string(), "HTML dir: " + layout.generated_html_dir.string()},
            {"Check directory permissions and available disk space."});
        return static_cast<int>(RunExitCode::CodeOutputFailure);
    }

    std::cout << "Generated base code cpp: " << code_paths.base_cpp_path << '\n';
    std::cout << "Generated target code cpp: " << code_paths.target_cpp_path << '\n';
    std::cout << "Generated base code html: " << code_paths.base_html_path << '\n';
    std::cout << "Generated target code html: " << code_paths.target_html_path << '\n';

    print_performance_report(artifacts.report);
    print_symbol_diagnostics(artifacts);

    const std::string report_output_path = (layout.analysis_report_dir / "analysis_report.json").string();
    if (!write_text_file(
            report_output_path,
            pipeline_report_to_json(
                artifacts.report,
                artifacts.symbol_tables,
                artifacts.line_hash_traces,
                get_last_transform_decisions())))
    {
        print_error_diagnostics(
            "Failed to write performance report.",
            {"Report path: " + report_output_path},
            {"Check directory permissions and available disk space."});
        return static_cast<int>(RunExitCode::ReportOutputFailure);
    }
    std::cout << "Performance JSON report generated: " << report_output_path << '\n';

    return static_cast<int>(RunExitCode::Success);
}
