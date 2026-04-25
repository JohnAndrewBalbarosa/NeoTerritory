#pragma once

#include <string>
#include <vector>

struct SourceFileUnit
{
    std::string file_name;
    std::string contents;
};

std::vector<SourceFileUnit> read_source_file_units(const std::vector<std::string>& paths);

std::string join_source_file_units(const std::vector<SourceFileUnit>& units);
