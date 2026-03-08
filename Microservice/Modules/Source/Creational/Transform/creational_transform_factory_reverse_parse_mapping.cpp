#include "internal/creational_transform_factory_reverse_internal.hpp"
#include "Transform/creational_code_generator_internal.hpp"

#include <cctype>
#include <regex>
#include <string>
#include <vector>

namespace creational_codegen_internal
{
void collect_if_branch_mapping(
    const std::string& function_body,
    const std::string& parameter_name,
    FactoryCreateMapping& out_mapping)
{
    const std::regex if_condition_regex(R"(\bif\s*\(([^)]*)\))");

    size_t cursor = 0;
    while (cursor < function_body.size())
    {
        std::smatch condition_match;
        const std::string remaining = function_body.substr(cursor);
        if (!std::regex_search(remaining, condition_match, if_condition_regex))
        {
            break;
        }

        const size_t local_condition_start = static_cast<size_t>(condition_match.position(0));
        const size_t local_condition_end = local_condition_start + static_cast<size_t>(condition_match.length(0));
        const size_t condition_end = cursor + local_condition_end;
        cursor += local_condition_start;

        std::string literal;
        if (!literal_from_condition(regex_capture_or_empty(condition_match, 1), parameter_name, literal))
        {
            cursor = condition_end;
            continue;
        }

        const StatementSlice statement = statement_after_condition(function_body, condition_end);
        if (statement.next_position == std::string::npos)
        {
            cursor = condition_end;
            continue;
        }

        const std::string return_expression = first_return_expression(statement.text);
        if (!return_expression.empty())
        {
            out_mapping.literal_to_entry[literal] = build_hash_ledger_entry(return_expression);
        }

        cursor = statement.next_position;
    }
}

void collect_switch_branch_mapping(
    const std::string& function_body,
    const std::string& parameter_name,
    FactoryCreateMapping& out_mapping)
{
    const std::regex switch_regex(R"(\bswitch\s*\(([^)]*)\))");

    size_t cursor = 0;
    while (cursor < function_body.size())
    {
        std::smatch switch_match;
        const std::string remaining = function_body.substr(cursor);
        if (!std::regex_search(remaining, switch_match, switch_regex))
        {
            break;
        }

        const std::string switch_expression = trim(regex_capture_or_empty(switch_match, 1));
        const size_t switch_signature_start = cursor + static_cast<size_t>(switch_match.position(0));
        const size_t switch_signature_end = switch_signature_start + static_cast<size_t>(switch_match.length(0));
        cursor = switch_signature_end;

        if (switch_expression != parameter_name)
        {
            continue;
        }

        size_t block_start = switch_signature_end;
        while (block_start < function_body.size() &&
               std::isspace(static_cast<unsigned char>(function_body[block_start])))
        {
            ++block_start;
        }

        if (block_start >= function_body.size() || function_body[block_start] != '{')
        {
            continue;
        }

        const size_t block_end = find_matching_brace(function_body, block_start);
        if (block_end == std::string::npos)
        {
            continue;
        }

        const std::string switch_block = function_body.substr(
            block_start + 1,
            block_end - block_start - 1);
        const std::regex label_regex(R"((case\s+([^:]+)\s*:)|(default\s*:))");

        struct SwitchLabel
        {
            size_t start = 0;
            size_t end = 0;
            bool is_default = false;
            std::string literal;
        };

        std::vector<SwitchLabel> labels;
        std::sregex_iterator it(switch_block.begin(), switch_block.end(), label_regex);
        std::sregex_iterator end;
        for (; it != end; ++it)
        {
            SwitchLabel label;
            label.start = static_cast<size_t>((*it).position(0));
            label.end = label.start + static_cast<size_t>((*it).length(0));
            label.is_default = !regex_capture_or_empty(*it, 3).empty();
            if (!label.is_default)
            {
                label.literal = normalize_literal(regex_capture_or_empty(*it, 2));
            }
            labels.push_back(std::move(label));
        }

        for (size_t i = 0; i < labels.size(); ++i)
        {
            const size_t segment_begin = labels[i].end;
            const size_t segment_end =
                (i + 1 < labels.size()) ? labels[i + 1].start : switch_block.size();
            if (segment_begin >= segment_end || segment_end > switch_block.size())
            {
                continue;
            }

            const std::string segment = switch_block.substr(segment_begin, segment_end - segment_begin);
            const std::string return_expression = first_return_expression(segment);
            if (return_expression.empty())
            {
                continue;
            }

            if (labels[i].is_default)
            {
                if (out_mapping.default_entry.creation_expression.empty())
                {
                    out_mapping.default_entry = build_hash_ledger_entry(return_expression);
                }
                continue;
            }

            if (!is_supported_literal(labels[i].literal))
            {
                continue;
            }

            out_mapping.literal_to_entry[labels[i].literal] = build_hash_ledger_entry(return_expression);
        }

        cursor = block_end + 1;
    }
}

void collect_top_level_default_return(
    const std::string& function_body,
    FactoryCreateMapping& out_mapping)
{
    size_t depth = 0;
    for (size_t i = 0; i < function_body.size(); ++i)
    {
        const char c = function_body[i];
        if (c == '{')
        {
            ++depth;
            continue;
        }
        if (c == '}')
        {
            if (depth > 0)
            {
                --depth;
            }
            continue;
        }

        if (depth != 0)
        {
            continue;
        }

        if (function_body.compare(i, 6, "return") != 0)
        {
            continue;
        }

        const bool has_left_identifier =
            (i > 0) &&
            (std::isalnum(static_cast<unsigned char>(function_body[i - 1])) ||
             function_body[i - 1] == '_');
        if (has_left_identifier)
        {
            continue;
        }

        const size_t semicolon = function_body.find(';', i + 6);
        if (semicolon == std::string::npos)
        {
            continue;
        }

        const std::string expression = trim(function_body.substr(i + 6, semicolon - (i + 6)));
        if (!expression.empty())
        {
            out_mapping.default_entry = build_hash_ledger_entry(expression);
        }
        i = semicolon;
    }
}

} // namespace creational_codegen_internal
