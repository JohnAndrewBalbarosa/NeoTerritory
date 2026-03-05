#ifndef ANALYSIS_CONTEXT_HPP
#define ANALYSIS_CONTEXT_HPP

#include <string>
#include <vector>

struct ParseTreeBuildContext
{
    std::string source_pattern;
    std::string target_pattern;
    std::vector<std::string> input_files;
};

#endif // ANALYSIS_CONTEXT_HPP
