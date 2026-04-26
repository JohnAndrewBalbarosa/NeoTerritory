#include "Analysis/Input/cli_arguments.hpp"
#include "Analysis/Input/source_reader.hpp"
#include "OutputGeneration/Contracts/algorithm_pipeline.hpp"

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

    const PipelineReport report = run_normalize_and_rewrite_pipeline(
        args.input_paths, args.output_path, args.catalog_path);

    if (args.verbose)
    {
        std::cout << "Detected patterns: " << report.detected_patterns.size() << "\n";
        std::cout << "Documentation targets: " << report.documentation_target_count << "\n";
        std::cout << "Unit-test targets: " << report.unit_test_target_count << "\n";
    }
    return 0;
}
