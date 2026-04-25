#include "Trees/Actual/Internal/contracts.hpp"

#include <sstream>

std::vector<std::string> split_lines(const std::string& text)
{
    std::vector<std::string> lines;
    std::istringstream       stream(text);
    std::string              line;
    while (std::getline(stream, line))
    {
        lines.push_back(line);
    }
    return lines;
}

std::string include_target_from_line(const std::string& line)
{
    const std::size_t open_position = line.find('"');
    if (open_position == std::string::npos)
    {
        const std::size_t angle_open = line.find('<');
        if (angle_open == std::string::npos)
        {
            return {};
        }
        const std::size_t angle_close = line.find('>', angle_open + 1);
        if (angle_close == std::string::npos)
        {
            return {};
        }
        return line.substr(angle_open + 1, angle_close - angle_open - 1);
    }
    const std::size_t close_position = line.find('"', open_position + 1);
    if (close_position == std::string::npos)
    {
        return {};
    }
    return line.substr(open_position + 1, close_position - open_position - 1);
}
