#include "Analysis/Input/cli_arguments.hpp"
#include "Analysis/Input/source_reader.hpp"
#include "OutputGeneration/Contracts/algorithm_pipeline.hpp"
#include "OutputGeneration/Render/codebase_output_writer.hpp"

#include <iostream>

int run_syntactic_broken_ast(int argc, char** argv)
{
    const CliArguments args = parse_cli_arguments(argc, argv);
    if (args.help)
    {
        std::cout << "NeoTerritory microservice: pattern detection and analysis pipeline\n";
        std::cout << "Usage: NeoTerritory [--output <path>] [--verbose] <input_paths...>\n";
        return 0;
    }
    if (args.input_paths.empty())
    {
        std::cerr << "No input paths provided. Use --help for usage.\n";
        return 1;
    }

    const PipelineReport report = run_normalize_and_rewrite_pipeline(args.input_paths, args.output_path);

    CodebaseOutputPaths paths;
    paths.root             = args.output_path;
    paths.html_directory   = args.output_path + "/html";
    paths.json_report_path = args.output_path + "/report.json";
    paths.evidence_directory = args.output_path + "/evidence";

    write_codebase_outputs(report, paths);

    if (args.verbose)
    {
        std::cout << "Detected patterns: " << report.detected_patterns.size() << "\n";
        std::cout << "Documentation targets: " << report.documentation_target_count << "\n";
        std::cout << "Unit-test targets: " << report.unit_test_target_count << "\n";
    }
    return 0;
}
