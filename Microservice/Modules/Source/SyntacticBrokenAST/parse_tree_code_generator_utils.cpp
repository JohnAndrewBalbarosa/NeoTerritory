#include "Internal/parse_tree_code_generator_internal.hpp"

#include <cctype>
#include <regex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

namespace parse_tree_codegen_internal
{
std::string lower(const std::string& s)
{
    return lowercase_ascii(s);
}

std::string trim(const std::string& input)
{
    size_t begin = 0;
    while (begin < input.size() && std::isspace(static_cast<unsigned char>(input[begin])))
    {
        ++begin;
    }

    size_t end = input.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }

    return input.substr(begin, end - begin);
}

std::vector<std::string> split_words(const std::string& text)
{
    std::vector<std::string> words;
    std::string current;

    for (char c : text)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
        }
        else if (!current.empty())
        {
            words.push_back(current);
            current.clear();
        }
    }

    if (!current.empty())
    {
        words.push_back(current);
    }

    return words;
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
}

size_t find_matching_brace(const std::string& text, size_t open_pos)
{
    if (open_pos >= text.size() || text[open_pos] != '{')
    {
        return std::string::npos;
    }

    int depth = 0;
    for (size_t i = open_pos; i < text.size(); ++i)
    {
        if (text[i] == '{')
        {
            ++depth;
        }
        else if (text[i] == '}')
        {
            --depth;
            if (depth == 0)
            {
                return i;
            }
        }
    }

    return std::string::npos;
}

TransformDecision& ensure_decision(
    std::unordered_map<std::string, TransformDecision>& decisions_by_class,
    const std::string& class_name)
{
    auto it = decisions_by_class.find(class_name);
    if (it != decisions_by_class.end())
    {
        return it->second;
    }

    TransformDecision decision;
    decision.class_name = class_name;
    auto inserted = decisions_by_class.insert({class_name, std::move(decision)});
    return inserted.first->second;
}

void add_reason_if_missing(TransformDecision& decision, const std::string& reason)
{
    for (const std::string& existing : decision.transform_reason)
    {
        if (existing == reason)
        {
            return;
        }
    }
    decision.transform_reason.push_back(reason);
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

std::string join_lines(const std::vector<std::string>& lines)
{
    std::ostringstream out;
    for (size_t i = 0; i < lines.size(); ++i)
    {
        if (i > 0)
        {
            out << '\n';
        }
        out << lines[i];
    }
    return out.str();
}

bool is_config_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return starts_with(lowered, "set") ||
           starts_with(lowered, "with") ||
           starts_with(lowered, "enable") ||
           starts_with(lowered, "disable") ||
           starts_with(lowered, "configure");
}

bool is_monolithic_config_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return starts_with(lowered, "set_") ||
           starts_with(lowered, "with_") ||
           starts_with(lowered, "enable_") ||
           starts_with(lowered, "configure_");
}

bool is_monolithic_build_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult";
}

bool is_build_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult";
}

bool is_operational_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return !is_config_method_name(method_name) &&
           !is_build_method_name(method_name) &&
           lowered != "instance";
}

bool ends_with(const std::string& text, const std::string& suffix)
{
    return text.size() >= suffix.size() &&
           text.compare(text.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::string strip_builder_suffix(const std::string& class_name)
{
    if (!ends_with(class_name, "Builder"))
    {
        return class_name;
    }
    return class_name.substr(0, class_name.size() - std::string("Builder").size());
}

void append_unique_token(std::vector<std::string>& out, const std::string& token)
{
    if (token.empty())
    {
        return;
    }
    for (const std::string& existing : out)
    {
        if (existing == token)
        {
            return;
        }
    }
    out.push_back(token);
}

void append_unique_line(std::vector<std::string>& out, const std::string& line)
{
    const std::string normalized = trim(line);
    if (normalized.empty())
    {
        return;
    }
    append_unique_token(out, normalized);
}

void append_unique_lines(std::vector<std::string>& out, const std::vector<std::string>& lines)
{
    for (const std::string& line : lines)
    {
        append_unique_line(out, line);
    }
}

std::string regex_capture_or_empty(const std::smatch& match, size_t index)
{
    if (index >= match.size())
    {
        return {};
    }
    return match[index].str();
}
} // namespace parse_tree_codegen_internal
