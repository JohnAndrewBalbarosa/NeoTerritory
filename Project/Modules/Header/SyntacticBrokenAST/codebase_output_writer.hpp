#ifndef CODEBASE_OUTPUT_WRITER_HPP
#define CODEBASE_OUTPUT_WRITER_HPP

#include <string>

struct CodebaseOutputPaths
{
    std::string base_cpp_path;
    std::string target_cpp_path;
    std::string base_html_path;
    std::string target_html_path;
};

bool write_codebase_outputs(
    const std::string& base_code,
    const std::string& target_code,
    const std::string& target_pattern,
    CodebaseOutputPaths& out_paths);

#endif // CODEBASE_OUTPUT_WRITER_HPP
