#include "Transform/creational_transform_factory_reverse.hpp"

#include "Transform/creational_code_generator_internal.hpp"

#include <cctype>
#include <regex>
#include <string>
#include <unordered_map>
#include <vector>

namespace creational_codegen_internal
{
namespace
{
struct SourceSpan
{
    size_t begin = 0;
    size_t end = 0;
};

enum class AllocationKind
{
    Unknown,
    MakeUnique,
    MakeShared,
    RawNew,
};

struct AllocationExpression
{
    AllocationKind kind = AllocationKind::Unknown;
    std::string concrete_type;
    std::string expression;
};

struct FactoryCreateMapping
{
    bool has_create_method = false;
    std::unordered_map<std::string, std::string> literal_to_return;
    std::string default_return_expression;
};

struct FactoryClassModel
{
    std::string class_name;
    SourceSpan class_span;
    FactoryCreateMapping create_mapping;
};

struct FactoryRewriteStats
{
    bool create_method_missing = false;
    bool branch_map_missing = false;
    bool callsite_found = false;
    bool non_literal_argument = false;
    bool no_matching_branch = false;
    bool unsupported_return_expression = false;
    bool allocator_declaration_mismatch = false;
    bool class_retained_due_remaining_references = false;
    size_t rewritten_callsites = 0;
};

struct StatementSlice
{
    std::string text;
    size_t next_position = std::string::npos;
};

struct CallsiteDeclaration
{
    bool matched = false;
    std::string indent;
    std::string declaration_type;
    std::string variable_name;
    std::string factory_class_name;
    std::string argument_expression;
};

std::string escape_regex_literal(const std::string& input)
{
    std::string escaped;
    escaped.reserve(input.size() * 2);

    for (char c : input)
    {
        switch (c)
        {
            case '\\':
            case '^':
            case '$':
            case '.':
            case '|':
            case '?':
            case '*':
            case '+':
            case '(':
            case ')':
            case '[':
            case ']':
            case '{':
            case '}':
                escaped.push_back('\\');
                escaped.push_back(c);
                break;
            default:
                escaped.push_back(c);
                break;
        }
    }

    return escaped;
}

size_t find_matching_paren(const std::string& text, size_t open_paren_position)
{
    if (open_paren_position >= text.size() || text[open_paren_position] != '(')
    {
        return std::string::npos;
    }

    int depth = 0;
    for (size_t i = open_paren_position; i < text.size(); ++i)
    {
        if (text[i] == '(')
        {
            ++depth;
        }
        else if (text[i] == ')')
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

bool is_supported_literal(const std::string& expression)
{
    const std::string literal = trim(expression);
    if (literal.empty())
    {
        return false;
    }

    if ((literal.front() == '"' && literal.back() == '"') ||
        (literal.front() == '\'' && literal.back() == '\''))
    {
        return literal.size() >= 2;
    }

    size_t start = 0;
    if (literal[start] == '+' || literal[start] == '-')
    {
        ++start;
    }
    if (start >= literal.size())
    {
        return false;
    }

    for (size_t i = start; i < literal.size(); ++i)
    {
        if (!std::isdigit(static_cast<unsigned char>(literal[i])))
        {
            return false;
        }
    }

    return true;
}

std::string normalize_literal(const std::string& expression)
{
    return trim(expression);
}

std::string first_return_expression(const std::string& body_text)
{
    const std::regex return_regex(R"(\breturn\s+([^;]+)\s*;)");
    std::smatch match;
    if (!std::regex_search(body_text, match, return_regex))
    {
        return {};
    }
    return trim(regex_capture_or_empty(match, 1));
}

bool parse_parameter_name_from_signature(
    const std::string& parameter_text,
    std::string& out_parameter_name)
{
    const std::string normalized = trim(parameter_text);
    if (normalized.empty() || normalized == "void")
    {
        return false;
    }

    if (normalized.find(',') != std::string::npos)
    {
        return false;
    }

    const std::vector<std::string> words = split_words(normalized);
    if (words.empty())
    {
        return false;
    }

    out_parameter_name = words.back();
    return !out_parameter_name.empty();
}

bool literal_from_condition(
    const std::string& condition_text,
    const std::string& parameter_name,
    std::string& out_literal)
{
    if (parameter_name.empty())
    {
        return false;
    }

    const std::string escaped_parameter = escape_regex_literal(parameter_name);
    const std::regex lhs_condition(
        "^\\s*" + escaped_parameter + R"(\s*==\s*(.+)\s*$)");
    const std::regex rhs_condition(
        "^\\s*(.+)\\s*==\\s*" + escaped_parameter + R"(\s*$)");

    std::smatch match;
    if (std::regex_match(condition_text, match, lhs_condition))
    {
        const std::string candidate = normalize_literal(regex_capture_or_empty(match, 1));
        if (is_supported_literal(candidate))
        {
            out_literal = candidate;
            return true;
        }
    }

    if (std::regex_match(condition_text, match, rhs_condition))
    {
        const std::string candidate = normalize_literal(regex_capture_or_empty(match, 1));
        if (is_supported_literal(candidate))
        {
            out_literal = candidate;
            return true;
        }
    }

    return false;
}

StatementSlice statement_after_condition(const std::string& text, size_t position)
{
    StatementSlice out;
    size_t cursor = position;
    while (cursor < text.size() && std::isspace(static_cast<unsigned char>(text[cursor])))
    {
        ++cursor;
    }

    if (cursor >= text.size())
    {
        return out;
    }

    if (text[cursor] == '{')
    {
        const size_t close_brace = find_matching_brace(text, cursor);
        if (close_brace == std::string::npos)
        {
            return out;
        }

        out.text = text.substr(cursor, close_brace - cursor + 1);
        out.next_position = close_brace + 1;
        return out;
    }

    const size_t end_statement = text.find(';', cursor);
    if (end_statement == std::string::npos)
    {
        return out;
    }

    out.text = text.substr(cursor, end_statement - cursor + 1);
    out.next_position = end_statement + 1;
    return out;
}

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
            out_mapping.literal_to_return[literal] = return_expression;
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
                if (out_mapping.default_return_expression.empty())
                {
                    out_mapping.default_return_expression = return_expression;
                }
                continue;
            }

            if (!is_supported_literal(labels[i].literal))
            {
                continue;
            }

            out_mapping.literal_to_return[labels[i].literal] = return_expression;
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
            out_mapping.default_return_expression = expression;
        }
        i = semicolon;
    }
}

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

        if (!out_mapping.literal_to_return.empty() || !out_mapping.default_return_expression.empty())
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

bool parse_allocation_expression(
    const std::string& expression,
    AllocationExpression& out_allocation)
{
    const std::string normalized = trim(expression);
    out_allocation.expression = normalized;

    std::smatch match;
    const std::regex make_unique_regex(
        R"(\bstd\s*::\s*make_unique\s*<\s*([A-Za-z_][A-Za-z0-9_:]*)\s*>\s*\()");
    if (std::regex_search(normalized, match, make_unique_regex))
    {
        out_allocation.kind = AllocationKind::MakeUnique;
        out_allocation.concrete_type = regex_capture_or_empty(match, 1);
        return !out_allocation.concrete_type.empty();
    }

    const std::regex make_shared_regex(
        R"(\bstd\s*::\s*make_shared\s*<\s*([A-Za-z_][A-Za-z0-9_:]*)\s*>\s*\()");
    if (std::regex_search(normalized, match, make_shared_regex))
    {
        out_allocation.kind = AllocationKind::MakeShared;
        out_allocation.concrete_type = regex_capture_or_empty(match, 1);
        return !out_allocation.concrete_type.empty();
    }

    const std::regex raw_new_regex(
        R"(\bnew\s+([A-Za-z_][A-Za-z0-9_:]*)\b)");
    if (std::regex_search(normalized, match, raw_new_regex))
    {
        out_allocation.kind = AllocationKind::RawNew;
        out_allocation.concrete_type = regex_capture_or_empty(match, 1);
        return !out_allocation.concrete_type.empty();
    }

    out_allocation.kind = AllocationKind::Unknown;
    out_allocation.concrete_type.clear();
    return false;
}

bool is_auto_declaration_type(const std::string& declaration_type)
{
    const std::regex auto_regex(R"(^\s*(?:const\s+)?auto(?:\s*[&*])?\s*$)");
    return std::regex_match(declaration_type, auto_regex);
}

bool rewrite_declaration_type(
    const std::string& declaration_type,
    const AllocationExpression& allocation,
    std::string& out_declaration_type)
{
    out_declaration_type = trim(declaration_type);
    if (is_auto_declaration_type(out_declaration_type))
    {
        return true;
    }

    std::smatch match;
    if (allocation.kind == AllocationKind::MakeUnique)
    {
        const std::regex unique_ptr_regex(
            R"(^(.*\bstd\s*::\s*unique_ptr\s*<\s*)([^>]+)(\s*>.*)$)");
        if (!std::regex_match(out_declaration_type, match, unique_ptr_regex))
        {
            return false;
        }

        out_declaration_type =
            regex_capture_or_empty(match, 1) + allocation.concrete_type + regex_capture_or_empty(match, 3);
        return true;
    }

    if (allocation.kind == AllocationKind::MakeShared)
    {
        const std::regex shared_ptr_regex(
            R"(^(.*\bstd\s*::\s*shared_ptr\s*<\s*)([^>]+)(\s*>.*)$)");
        if (!std::regex_match(out_declaration_type, match, shared_ptr_regex))
        {
            return false;
        }

        out_declaration_type =
            regex_capture_or_empty(match, 1) + allocation.concrete_type + regex_capture_or_empty(match, 3);
        return true;
    }

    if (allocation.kind == AllocationKind::RawNew)
    {
        const std::regex raw_pointer_regex(
            R"(^\s*((?:const\s+)?)([A-Za-z_][A-Za-z0-9_:]*)\s*\*\s*$)");
        if (!std::regex_match(out_declaration_type, match, raw_pointer_regex))
        {
            return false;
        }

        out_declaration_type =
            regex_capture_or_empty(match, 1) + allocation.concrete_type + "*";
        return true;
    }

    return false;
}

CallsiteDeclaration parse_factory_callsite_declaration_line(const std::string& line)
{
    CallsiteDeclaration out;
    const std::regex declaration_regex(
        R"(^(\s*)([^;=]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*::\s*create\s*\(([^;]*)\)\s*;\s*$)");

    std::smatch match;
    if (!std::regex_match(line, match, declaration_regex))
    {
        return out;
    }

    out.matched = true;
    out.indent = regex_capture_or_empty(match, 1);
    out.declaration_type = trim(regex_capture_or_empty(match, 2));
    out.variable_name = regex_capture_or_empty(match, 3);
    out.factory_class_name = regex_capture_or_empty(match, 4);
    out.argument_expression = trim(regex_capture_or_empty(match, 5));
    return out;
}

std::string build_rewritten_callsite_line(
    const CallsiteDeclaration& callsite,
    const std::string& rewritten_declaration_type,
    const std::string& rewritten_expression)
{
    return callsite.indent + rewritten_declaration_type + " " + callsite.variable_name +
           " = " + rewritten_expression + ";";
}

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
} // namespace

FactoryReverseTransformResult transform_factory_to_base_by_direct_instantiation(
    const std::string& source)
{
    FactoryReverseTransformResult out;
    out.transformed_source = source;

    std::vector<FactoryClassModel> factory_classes = collect_factory_classes(source);
    if (factory_classes.empty())
    {
        return out;
    }

    std::unordered_map<std::string, FactoryClassModel> class_by_name;
    std::unordered_map<std::string, FactoryRewriteStats> stats_by_name;
    for (const FactoryClassModel& model : factory_classes)
    {
        class_by_name[model.class_name] = model;
        FactoryRewriteStats& stats = stats_by_name[model.class_name];
        stats.create_method_missing = !model.create_mapping.has_create_method;
        stats.branch_map_missing =
            model.create_mapping.literal_to_return.empty() &&
            model.create_mapping.default_return_expression.empty();
    }

    std::vector<std::string> lines = split_lines(out.transformed_source);
    for (std::string& line : lines)
    {
        const CallsiteDeclaration callsite = parse_factory_callsite_declaration_line(line);
        if (!callsite.matched)
        {
            continue;
        }

        const auto class_hit = class_by_name.find(callsite.factory_class_name);
        if (class_hit == class_by_name.end())
        {
            continue;
        }

        FactoryRewriteStats& stats = stats_by_name[callsite.factory_class_name];
        stats.callsite_found = true;

        if (!is_supported_literal(callsite.argument_expression))
        {
            stats.non_literal_argument = true;
            continue;
        }

        const std::string normalized_literal = normalize_literal(callsite.argument_expression);
        const FactoryCreateMapping& mapping = class_hit->second.create_mapping;

        std::string mapped_return_expression;
        const auto literal_hit = mapping.literal_to_return.find(normalized_literal);
        if (literal_hit != mapping.literal_to_return.end())
        {
            mapped_return_expression = literal_hit->second;
        }
        else if (!mapping.default_return_expression.empty())
        {
            mapped_return_expression = mapping.default_return_expression;
        }
        else
        {
            stats.no_matching_branch = true;
            continue;
        }

        AllocationExpression allocation;
        if (!parse_allocation_expression(mapped_return_expression, allocation))
        {
            stats.unsupported_return_expression = true;
            continue;
        }

        std::string rewritten_declaration_type;
        if (!rewrite_declaration_type(callsite.declaration_type, allocation, rewritten_declaration_type))
        {
            stats.allocator_declaration_mismatch = true;
            continue;
        }

        line = build_rewritten_callsite_line(callsite, rewritten_declaration_type, allocation.expression);
        ++stats.rewritten_callsites;
    }

    out.transformed_source = join_lines(lines);

    for (const FactoryClassModel& model : factory_classes)
    {
        FactoryRewriteStats& stats = stats_by_name[model.class_name];
        if (stats.rewritten_callsites == 0)
        {
            continue;
        }

        SourceSpan span;
        if (!locate_class_span_by_name(out.transformed_source, model.class_name, span))
        {
            continue;
        }

        if (has_class_reference_outside_span(out.transformed_source, model.class_name, span))
        {
            stats.class_retained_due_remaining_references = true;
            continue;
        }

        erase_span_with_trailing_newlines(out.transformed_source, span);
    }

    for (const FactoryClassModel& model : factory_classes)
    {
        const FactoryRewriteStats& stats = stats_by_name[model.class_name];

        TransformDecision decision;
        decision.class_name = model.class_name;
        decision.transform_applied = stats.rewritten_callsites > 0;

        if (stats.create_method_missing)
        {
            add_reason_if_missing(decision, "factory_create_method_not_found");
        }
        if (stats.branch_map_missing)
        {
            add_reason_if_missing(decision, "factory_branch_map_not_found");
        }
        if (!stats.callsite_found)
        {
            add_reason_if_missing(decision, "no_factory_callsite_found");
        }
        if (stats.non_literal_argument)
        {
            add_reason_if_missing(decision, "non_literal_factory_argument_unsupported");
        }
        if (stats.no_matching_branch)
        {
            add_reason_if_missing(decision, "no_matching_factory_branch_for_literal");
        }
        if (stats.unsupported_return_expression)
        {
            add_reason_if_missing(decision, "unsupported_factory_return_expression");
        }
        if (stats.allocator_declaration_mismatch)
        {
            add_reason_if_missing(decision, "allocator_declaration_mismatch");
        }
        if (stats.class_retained_due_remaining_references)
        {
            add_reason_if_missing(decision, "factory_class_retained_due_remaining_references");
        }

        out.decisions.push_back(std::move(decision));
    }

    return out;
}
} // namespace creational_codegen_internal
