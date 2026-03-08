#include "Internal/parse_tree_internal.hpp"
#include "language_tokens.hpp"

#include <cctype>
#include <sstream>
#include <string>
#include <vector>

namespace parse_tree_internal
{
std::vector<std::string> tokenize_text(const std::string& source)
{
    std::vector<std::string> tokens;
    std::string current;

    auto flush_current = [&]() {
        if (!current.empty())
        {
            tokens.push_back(current);
            current.clear();
        }
    };

    for (size_t i = 0; i < source.size(); ++i)
    {
        const char c = source[i];

        if (std::isspace(static_cast<unsigned char>(c)))
        {
            flush_current();
            continue;
        }

        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
            continue;
        }

        flush_current();

        if ((c == ':' || c == '=' || c == '!' || c == '<' || c == '>') &&
            i + 1 < source.size() && source[i + 1] == '=')
        {
            tokens.emplace_back(source.substr(i, 2));
            ++i;
            continue;
        }

        if (c == ':' && i + 1 < source.size() && source[i + 1] == ':')
        {
            tokens.emplace_back("::");
            ++i;
            continue;
        }
        if (c == '-' && i + 1 < source.size() && source[i + 1] == '>')
        {
            tokens.emplace_back("->");
            ++i;
            continue;
        }

        tokens.emplace_back(1, c);
    }

    flush_current();
    return tokens;
}

std::string join_tokens(const std::vector<std::string>& tokens, size_t start, size_t end)
{
    if (start >= end)
    {
        return {};
    }

    std::ostringstream out;
    for (size_t i = start; i < end; ++i)
    {
        if (i > start)
        {
            out << ' ';
        }
        out << tokens[i];
    }
    return out.str();
}

std::vector<std::string> split_lines(const std::string& source)
{
    std::vector<std::string> lines;
    std::string current;

    for (char c : source)
    {
        if (c == '\n')
        {
            lines.push_back(current);
            current.clear();
        }
        else if (c != '\r')
        {
            current.push_back(c);
        }
    }
    lines.push_back(current);

    return lines;
}

std::string file_basename(const std::string& path)
{
    const size_t slash = path.find_last_of("/\\");
    if (slash == std::string::npos)
    {
        return path;
    }
    return path.substr(slash + 1);
}

std::string include_target_from_line(const std::string& line)
{
    const std::vector<std::string> t = tokenize_text(line);
    if (t.size() < 3 || t[0] != "#" || lowercase_ascii(t[1]) != "include")
    {
        return {};
    }

    if (t[2] == "<")
    {
        std::string out;
        for (size_t i = 3; i < t.size() && t[i] != ">"; ++i)
        {
            out += t[i];
        }
        return out;
    }

    if (t[2] == "\"")
    {
        std::string out;
        for (size_t i = 3; i < t.size() && t[i] != "\""; ++i)
        {
            out += t[i];
        }
        return out;
    }

    return t[2];
}
} // namespace parse_tree_internal
