#include "internal/creational_transform_evidence_internal.hpp"

#include <regex>
#include <unordered_set>

namespace creational_codegen_internal
{
std::vector<std::string> collect_class_signature_lines(
    const std::vector<std::string>& lines,
    const std::vector<std::string>& class_names)
{
    std::unordered_set<std::string> wanted(class_names.begin(), class_names.end());
    if (wanted.empty())
    {
        return {};
    }

    const std::regex class_decl_regex(R"(\b(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b)");
    std::vector<std::string> out;

    for (const std::string& line : lines)
    {
        const std::string trimmed_line = trim(line);
        std::smatch match;
        if (std::regex_search(trimmed_line, match, class_decl_regex))
        {
            const std::string class_name = regex_capture_or_empty(match, 2);
            if (wanted.find(class_name) != wanted.end())
            {
                append_unique_line(out, trimmed_line);
            }
        }
    }

    return out;
}

std::vector<std::string> collect_method_signature_lines(
    const std::vector<std::string>& lines,
    const std::vector<std::string>& method_names)
{
    std::vector<std::string> out;
    if (method_names.empty())
    {
        return out;
    }

    for (const std::string& line : lines)
    {
        const std::string trimmed_line = trim(line);
        if (trimmed_line.empty())
        {
            continue;
        }

        for (const std::string& method_name : method_names)
        {
            const std::string method_token = method_name + "(";
            if (trimmed_line.find(method_token) == std::string::npos)
            {
                continue;
            }
            if (trimmed_line.find("." + method_token) != std::string::npos ||
                trimmed_line.find("->" + method_token) != std::string::npos)
            {
                continue;
            }

            append_unique_line(out, trimmed_line);
            break;
        }
    }

    return out;
}
} // namespace creational_codegen_internal
