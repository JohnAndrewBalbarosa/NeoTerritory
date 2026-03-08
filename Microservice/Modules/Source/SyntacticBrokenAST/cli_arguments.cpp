#include "cli_arguments.hpp"

#include <sstream>
#include <string>
#include <vector>

namespace
{
std::vector<std::string> split_whitespace_tokens(const std::string& text)
{
    std::vector<std::string> tokens;
    std::istringstream input(text);
    std::string token;
    while (input >> token)
    {
        tokens.push_back(token);
    }
    return tokens;
}

std::string format_usage_with_argc(int argc)
{
    return
        "Usage: NeoTerritory <source_pattern> <target_pattern>\n"
        "Received argc=" + std::to_string(argc);
}
} // namespace

bool parse_cli_arguments(int argc, char* argv[], CliArguments& out, std::string& error)
{
    // Required:
    // argv[1] = source design pattern
    // argv[2] = target design pattern
    out.input_files.clear();
    out.source_pattern.clear();
    out.target_pattern.clear();

    // Compatibility path for launch profiles that pass both args as one string:
    // argv[1] = "<source_pattern> <target_pattern>"
    if (argc == 2 && argv[1] != nullptr)
    {
        const std::vector<std::string> tokens = split_whitespace_tokens(std::string(argv[1]));
        if (tokens.size() == 2)
        {
            out.source_pattern = tokens[0];
            out.target_pattern = tokens[1];
        }
        else if (tokens.size() > 2)
        {
            error =
                "Folder-only input mode is enabled.\n"
                "Do not pass file paths as extra CLI arguments.\n" +
                format_usage_with_argc(argc);
            return false;
        }
    }

    if (out.source_pattern.empty() || out.target_pattern.empty())
    {
        if (argc < 3)
        {
            error = format_usage_with_argc(argc);
            if (argc == 1)
            {
                error +=
                    "\nNo CLI args were passed to the process."
                    "\nThis usually means the Visual Studio launch profile args were not activated.";
            }
            return false;
        }

        if (argc > 3)
        {
            error =
                "Folder-only input mode is enabled.\n"
                "Do not pass file paths as extra CLI arguments.\n" +
                format_usage_with_argc(argc);
            return false;
        }

        out.source_pattern = argv[1] == nullptr ? "" : std::string(argv[1]);
        out.target_pattern = argv[2] == nullptr ? "" : std::string(argv[2]);
    }

    if (out.source_pattern.empty() || out.target_pattern.empty())
    {
        error = "Source and target design pattern parameters are required.";
        return false;
    }

    return true;
}
