#include "cli_arguments.hpp"

#include <string>

bool parse_cli_arguments(int argc, char* argv[], CliArguments& out, std::string& error)
{
    // Required:
    // argv[1] = source design pattern
    // argv[2] = target design pattern
    // argv[3..] = one or many input files
    if (argc < 4)
    {
        error = "Usage: NeoTerritory <source_pattern> <target_pattern> <file1> [file2 ...]";
        return false;
    }

    out.source_pattern = argv[1] == nullptr ? "" : std::string(argv[1]);
    out.target_pattern = argv[2] == nullptr ? "" : std::string(argv[2]);
    out.input_files.clear();

    for (int i = 3; i < argc; ++i)
    {
        if (argv[i] == nullptr)
        {
            continue;
        }
        const std::string path = argv[i];
        if (!path.empty())
        {
            out.input_files.push_back(path);
        }
    }

    if (out.source_pattern.empty() || out.target_pattern.empty())
    {
        error = "Source and target design pattern parameters are required.";
        return false;
    }
    if (out.input_files.empty())
    {
        error = "At least one input file is required.";
        return false;
    }

    return true;
}
