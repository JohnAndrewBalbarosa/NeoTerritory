#include "internal/creational_transform_factory_reverse_internal.hpp"
#include "Transform/creational_code_generator_internal.hpp"

#include <regex>
#include <string>

namespace creational_codegen_internal
{
bool locate_class_span_by_name(
    const std::string& source,
    const std::string& class_name,
    SourceSpan& out_span)
{
    const std::regex class_regex(
        R"(\b(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b)");

    size_t cursor = 0;
    while (cursor < source.size())
    {
        std::smatch class_match;
        const std::string remaining = source.substr(cursor);
        if (!std::regex_search(remaining, class_match, class_regex))
        {
            break;
        }

        const size_t class_decl_start = cursor + static_cast<size_t>(class_match.position(0));
        const size_t class_decl_end = class_decl_start + static_cast<size_t>(class_match.length(0));
        const std::string matched_class_name = regex_capture_or_empty(class_match, 2);

        if (matched_class_name != class_name)
        {
            cursor = class_decl_end;
            continue;
        }

        const size_t class_open = source.find('{', class_decl_end);
        const size_t decl_semicolon = source.find(';', class_decl_end);
        if (class_open == std::string::npos ||
            (decl_semicolon != std::string::npos && decl_semicolon < class_open))
        {
            cursor = class_decl_end;
            continue;
        }

        const size_t class_close = find_matching_brace(source, class_open);
        if (class_close == std::string::npos)
        {
            cursor = class_decl_end;
            continue;
        }

        const size_t class_end_semicolon = source.find(';', class_close);
        if (class_end_semicolon == std::string::npos)
        {
            cursor = class_close + 1;
            continue;
        }

        out_span = SourceSpan{class_decl_start, class_end_semicolon + 1};
        return true;
    }

    return false;
}

bool has_class_reference_outside_span(
    const std::string& source,
    const std::string& class_name,
    const SourceSpan& class_span)
{
    if (class_span.end > source.size() || class_span.begin > class_span.end)
    {
        return true;
    }

    const std::string outside_text =
        source.substr(0, class_span.begin) +
        source.substr(class_span.end);
    const std::regex reference_regex(
        "\\b" + escape_regex_literal(class_name) + "\\b");
    return std::regex_search(outside_text, reference_regex);
}

void erase_span_with_trailing_newlines(std::string& source, const SourceSpan& span)
{
    if (span.end > source.size() || span.begin >= span.end)
    {
        return;
    }

    size_t erase_begin = span.begin;
    size_t erase_end = span.end;
    while (erase_end < source.size() && source[erase_end] == '\n')
    {
        ++erase_end;
    }

    source.erase(erase_begin, erase_end - erase_begin);
}
} // namespace creational_codegen_internal
