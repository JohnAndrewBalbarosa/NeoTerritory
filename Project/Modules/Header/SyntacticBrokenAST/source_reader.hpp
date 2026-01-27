#ifndef SOURCE_READER_HPP
#define SOURCE_READER_HPP

#include <string>

/**
 * @brief Reads source code from file or stdin
 * @param argc Argument count
 * @param argv Argument values
 * @return Source code string
 */
std::string read_source(int argc, char* argv[]);

#endif // SOURCE_READER_HPP
