#include "Analysis/Input/source_reader.hpp"

#include <fstream>
#include <sstream>

std::vector<SourceFileUnit> read_source_file_units(const std::vector<std::string>& paths)
{
    std::vector<SourceFileUnit> units;
    units.reserve(paths.size());
    for (const std::string& path : paths)
    {
        SourceFileUnit unit;
        unit.file_name = path;
        std::ifstream stream(path);
        if (stream.is_open())
        {
            std::ostringstream buffer;
            buffer << stream.rdbuf();
            unit.contents = buffer.str();
        }
        units.push_back(std::move(unit));
    }
    return units;
}

std::string join_source_file_units(const std::vector<SourceFileUnit>& units)
{
    std::string joined;
    for (const SourceFileUnit& unit : units)
    {
        joined += unit.contents;
        joined += '\n';
    }
    return joined;
}
