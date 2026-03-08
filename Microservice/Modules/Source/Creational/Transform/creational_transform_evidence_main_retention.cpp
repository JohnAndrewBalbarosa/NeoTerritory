#include "internal/creational_transform_evidence_internal.hpp"

#include <regex>

namespace creational_codegen_internal
{
int brace_delta(const std::string& line)
{
    int delta = 0;
    for (char c : line)
    {
        if (c == '{')
        {
            ++delta;
        }
        else if (c == '}')
        {
            --delta;
        }
    }
    return delta;
}

std::string retain_single_main_function(
    const std::string& code,
    const std::string& preferred_file_hint)
{
    const std::vector<std::string> lines = split_lines(code);
    std::vector<std::string> out;
    out.reserve(lines.size());

    const std::regex main_signature_regex(R"(^\s*(?:int|auto)\s+main\s*\()");
    const std::regex file_marker_regex(R"(^\s*//\s*===\s*FILE:\s*(.+?)\s*===\s*$)");

    struct MainOccurrence
    {
        size_t line_index = 0;
        std::string file_marker;
    };

    std::vector<MainOccurrence> main_occurrences;
    std::string current_file_marker;
    for (size_t i = 0; i < lines.size(); ++i)
    {
        std::smatch marker_match;
        if (std::regex_match(lines[i], marker_match, file_marker_regex))
        {
            current_file_marker = lower(trim(regex_capture_or_empty(marker_match, 1)));
        }

        if (std::regex_search(lines[i], main_signature_regex))
        {
            main_occurrences.push_back(MainOccurrence{i, current_file_marker});
        }
    }

    if (main_occurrences.empty())
    {
        return code;
    }

    size_t keep_main_line_index = main_occurrences.front().line_index;
    const std::string normalized_hint = lower(trim(preferred_file_hint));
    if (!normalized_hint.empty())
    {
        bool matched_by_hint = false;
        for (const MainOccurrence& occurrence : main_occurrences)
        {
            if (occurrence.file_marker.find(normalized_hint) != std::string::npos)
            {
                keep_main_line_index = occurrence.line_index;
                matched_by_hint = true;
                break;
            }
        }

        if (!matched_by_hint)
        {
            const size_t separator = normalized_hint.find("_to_");
            if (separator != std::string::npos)
            {
                const std::string source_hint = normalized_hint.substr(0, separator);
                for (const MainOccurrence& occurrence : main_occurrences)
                {
                    if (occurrence.file_marker.find(source_hint) != std::string::npos)
                    {
                        keep_main_line_index = occurrence.line_index;
                        break;
                    }
                }
            }
        }
    }

    bool kept_main = false;
    bool skipping_main = false;
    bool skip_has_open_brace = false;
    int skip_depth = 0;

    for (size_t i = 0; i < lines.size(); ++i)
    {
        const std::string& line = lines[i];
        if (skipping_main)
        {
            if (line.find('{') != std::string::npos)
            {
                skip_has_open_brace = true;
            }
            skip_depth += brace_delta(line);
            if (skip_has_open_brace && skip_depth <= 0)
            {
                skipping_main = false;
                skip_has_open_brace = false;
                skip_depth = 0;
            }
            continue;
        }

        if (std::regex_search(line, main_signature_regex))
        {
            if (!kept_main && i == keep_main_line_index)
            {
                kept_main = true;
                out.push_back(line);
                continue;
            }

            skipping_main = true;
            skip_has_open_brace = line.find('{') != std::string::npos;
            skip_depth = brace_delta(line);
            if (skip_has_open_brace && skip_depth <= 0)
            {
                skipping_main = false;
                skip_has_open_brace = false;
                skip_depth = 0;
            }
            continue;
        }

        out.push_back(line);
    }

    return join_lines(out);
}

} // namespace creational_codegen_internal
