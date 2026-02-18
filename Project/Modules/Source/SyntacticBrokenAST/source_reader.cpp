#include "source_reader.hpp"

#include <fstream>
#include <iostream>
#include <sstream>

std::string read_source_files(const std::vector<std::string>& files)
{
    if (files.empty())
    {
        return {};
    }

    std::ostringstream merged;
    for (size_t i = 0; i < files.size(); ++i)
    {
        const std::string& path = files[i];
        std::ifstream file(path);
        if (!file)
        {
            std::cerr << "Failed to open " << path << '\n';
            return {};
        }

        merged << "\n// === FILE: " << path << " ===\n";
        merged << file.rdbuf();
        if (i + 1 < files.size())
        {
            merged << '\n';
        }
    }

    return merged.str();
}
