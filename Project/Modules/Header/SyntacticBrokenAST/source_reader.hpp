#ifndef SOURCE_READER_HPP
#define SOURCE_READER_HPP

#include <string>
#include <vector>

struct SourceFileUnit
{
    std::string path;
    std::string content;
};

/**
 * @brief Reads one or more source files into separate file units.
 * @param files Input file paths
 * @return File units with path + content
 */
std::vector<SourceFileUnit> read_source_file_units(const std::vector<std::string>& files);

/**
 * @brief Helper to concatenate file units for plain text/code output generation.
 */
std::string join_source_file_units(const std::vector<SourceFileUnit>& units);

#endif // SOURCE_READER_HPP
