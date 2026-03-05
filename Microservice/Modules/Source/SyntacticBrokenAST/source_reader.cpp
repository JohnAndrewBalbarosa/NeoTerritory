#include "source_reader.hpp"

#include <fstream>
#include <iostream>
#include <sstream>

std::vector<SourceFileUnit> read_source_file_units(const std::vector<std::string>& files)
{
    if (files.empty())
    {
        return {};
    }

    std::vector<SourceFileUnit> units;
    units.reserve(files.size());

    for (const std::string& path : files)
    {
        std::ifstream file(path);
        if (!file)
        {
            std::cerr << "Failed to open " << path << '\n';
            return {};
        }

        SourceFileUnit unit;
        unit.path = path;
        std::ostringstream buffer;
        buffer << file.rdbuf();
        unit.content = buffer.str();
        units.push_back(std::move(unit));
    }

    return units;
}

std::string join_source_file_units(const std::vector<SourceFileUnit>& units)
{
    std::ostringstream merged;
    for (size_t i = 0; i < units.size(); ++i)
    {
        merged << "\n// === FILE: " << units[i].path << " ===\n";
        merged << units[i].content;
        if (i + 1 < units.size())
        {
            merged << '\n';
        }
    }
    return merged.str();
}
