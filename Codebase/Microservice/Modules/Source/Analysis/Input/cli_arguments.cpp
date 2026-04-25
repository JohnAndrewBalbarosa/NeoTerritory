#include "Analysis/Input/cli_arguments.hpp"

#include <string>

CliArguments parse_cli_arguments(int argc, char** argv)
{
    CliArguments args;
    for (int i = 1; i < argc; ++i)
    {
        const std::string token = argv[i];
        if (token == "--help" || token == "-h")
        {
            args.help = true;
        }
        else if (token == "--verbose" || token == "-v")
        {
            args.verbose = true;
        }
        else if (token == "--output" || token == "-o")
        {
            if (i + 1 < argc)
            {
                args.output_path = argv[++i];
            }
        }
        else
        {
            args.input_paths.push_back(token);
        }
    }
    return args;
}
