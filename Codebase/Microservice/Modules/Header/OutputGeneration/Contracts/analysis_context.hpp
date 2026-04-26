#pragma once

#include <string>
#include <vector>

struct ParseTreeBuildContext
{
    std::vector<std::string> input_paths;
    std::string              output_path;
    std::string              catalog_path;
    std::string              language    = "cpp";
    bool                     verbose     = false;
};
