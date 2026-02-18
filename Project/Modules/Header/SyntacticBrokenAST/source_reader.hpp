#ifndef SOURCE_READER_HPP
#define SOURCE_READER_HPP

#include <string>
#include <vector>

/**
 * @brief Reads one or more source files and merges them.
 * @param files Input file paths
 * @return Source code string
 */
std::string read_source_files(const std::vector<std::string>& files);

#endif // SOURCE_READER_HPP
