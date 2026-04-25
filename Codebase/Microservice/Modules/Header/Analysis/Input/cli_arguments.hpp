#pragma once

#include <string>
#include <vector>

struct CliArguments
{
    std::vector<std::string> input_paths;
    std::string              output_path;
    bool                     verbose = false;
    bool                     help    = false;
};

CliArguments parse_cli_arguments(int argc, char** argv);
