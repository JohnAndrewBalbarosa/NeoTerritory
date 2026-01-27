#include "source_reader.hpp"
#include <fstream>
#include <sstream>
#include <iostream>

std::string read_source(int argc, char* argv[])
{
    if (argc > 1)
    {
        std::ifstream file(argv[1]);
        if (!file)
        {
            std::cerr << "Failed to open " << argv[1] << '\n';
            return {};
        }
        std::ostringstream buffer;
        buffer << file.rdbuf();
        return buffer.str();
    }
    
    if (std::cin.rdbuf()->in_avail() > 0 || !std::cin.eof())
    {
        std::ostringstream buffer;
        buffer << std::cin.rdbuf();
        return buffer.str();
    }
    
    return {};
}
