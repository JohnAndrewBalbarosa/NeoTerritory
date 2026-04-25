#include "Trees/Actual/Internal/contracts.hpp"

#include <sstream>

std::vector<std::string> tokenize_text(const std::string& text)
{
    std::vector<std::string> tokens;
    std::istringstream       stream(text);
    std::string              token;
    while (stream >> token)
    {
        tokens.push_back(token);
    }
    return tokens;
}

std::string join_tokens(const std::vector<std::string>& tokens, const std::string& separator)
{
    std::string joined;
    for (std::size_t index = 0; index < tokens.size(); ++index)
    {
        if (index > 0)
        {
            joined += separator;
        }
        joined += tokens[index];
    }
    return joined;
}

std::string detect_statement_kind(const std::string& line)
{
    if (is_class_or_struct_signature(line))
    {
        return "class";
    }
    if (is_function_signature(line))
    {
        return "function";
    }
    return "statement";
}

bool is_class_or_struct_signature(const std::string& line)
{
    return line.find("class ") != std::string::npos || line.find("struct ") != std::string::npos;
}

bool is_function_signature(const std::string& line)
{
    return line.find('(') != std::string::npos && line.find(')') != std::string::npos;
}
