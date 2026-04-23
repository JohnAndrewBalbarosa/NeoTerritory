#include "internal/creational_transform_factory_reverse_internal.hpp"
#include "Transform/creational_code_generator_internal.hpp"

#include <cctype>
#include <regex>
#include <string>
#include <vector>

namespace creational_codegen_internal
{
bool parse_create_mapping_from_class_body(
    const std::string& class_body,
    FactoryCreateMapping& out_mapping)
{
    size_t cursor = 0;
    while (cursor < class_body.size())
    {
        const size_t token_position = class_body.find("create", cursor);
        if (token_position == std::string::npos)
        {
            break;
        }

        const bool invalid_left =
            token_position > 0 &&
            (std::isalnum(static_cast<unsigned char>(class_body[token_position - 1])) ||
             class_body[token_position - 1] == '_');
        const size_t token_end = token_position + std::string("create").size();
        const bool invalid_right =
            token_end < class_body.size() &&
            (std::isalnum(static_cast<unsigned char>(class_body[token_end])) ||
             class_body[token_end] == '_');
        if (invalid_left || invalid_right)
        {
            cursor = token_end;
            continue;
        }

        size_t open_paren = token_end;
        while (open_paren < class_body.size() &&
               std::isspace(static_cast<unsigned char>(class_body[open_paren])))
        {
            ++open_paren;
        }
        if (open_paren >= class_body.size() || class_body[open_paren] != '(')
        {
            cursor = token_end;
            continue;
        }

        const size_t close_paren = find_matching_paren(class_body, open_paren);
        if (close_paren == std::string::npos)
        {
            cursor = token_end;
            continue;
        }

        std::string parameter_name;
        if (!parse_parameter_name_from_signature(
                class_body.substr(open_paren + 1, close_paren - open_paren - 1),
                parameter_name))
        {
            cursor = close_paren + 1;
            continue;
        }

        size_t body_open = close_paren + 1;
        while (body_open < class_body.size() && class_body[body_open] != '{' && class_body[body_open] != ';')
        {
            ++body_open;
        }

        if (body_open >= class_body.size() || class_body[body_open] != '{')
        {
            cursor = close_paren + 1;
            continue;
        }

        const size_t body_close = find_matching_brace(class_body, body_open);
        if (body_close == std::string::npos)
        {
            cursor = close_paren + 1;
            continue;
        }

        out_mapping.has_create_method = true;

        const std::string function_body = class_body.substr(body_open + 1, body_close - body_open - 1);
        collect_if_branch_mapping(function_body, parameter_name, out_mapping);
        collect_switch_branch_mapping(function_body, parameter_name, out_mapping);
        collect_top_level_default_return(function_body, out_mapping);

        if (!out_mapping.literal_to_entry.empty() || !out_mapping.default_entry.creation_expression.empty())
        {
            return true;
        }

        cursor = body_close + 1;
    }

    return out_mapping.has_create_method;
}

std::vector<FactoryClassModel> collect_factory_classes(const std::string& source)
{
    std::vector<FactoryClassModel> out;
    const std::regex class_regex(R"(\b(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b)");

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
        const std::string class_name = regex_capture_or_empty(class_match, 2);

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

        FactoryClassModel model;
        model.class_name = class_name;
        model.class_span = SourceSpan{class_decl_start, class_end_semicolon + 1};

        const std::string class_body = source.substr(class_open + 1, class_close - class_open - 1);
        parse_create_mapping_from_class_body(class_body, model.create_mapping);

        if (model.create_mapping.has_create_method)
        {
            out.push_back(std::move(model));
        }

        cursor = class_end_semicolon + 1;
    }

    return out;
}

} // namespace creational_codegen_internal
