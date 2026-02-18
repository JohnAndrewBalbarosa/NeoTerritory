#ifndef CLI_ARGUMENTS_HPP
#define CLI_ARGUMENTS_HPP

#include <string>
#include <vector>

struct CliArguments
{
    std::string source_pattern;
    std::string target_pattern;
    std::vector<std::string> input_files;
};

bool parse_cli_arguments(int argc, char* argv[], CliArguments& out, std::string& error);

#endif // CLI_ARGUMENTS_HPP
