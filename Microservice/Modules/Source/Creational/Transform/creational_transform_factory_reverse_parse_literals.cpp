#include "internal/creational_transform_factory_reverse_internal.hpp"
#include "Transform/creational_code_generator_internal.hpp"

#include <cctype>
#include <iomanip>
#include <regex>
#include <sstream>
#include <string>

namespace creational_codegen_internal
{
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

std::string collapse_ascii_whitespace(const std::string& input)
{
    std::string out;
    out.reserve(input.size());

    bool pending_space = false;
    for (char c : input)
    {
        if (std::isspace(static_cast<unsigned char>(c)))
        {
            pending_space = true;
            continue;
        }

        if (pending_space && !out.empty())
        {
            out.push_back(' ');
        }
        pending_space = false;
        out.push_back(c);
    }

    return trim(out);
}

std::string make_vital_part_hash_id(const std::string& normalized_vital_part)
{
    const uint64_t fnv_offset_basis = 14695981039346656037ull;
    const uint64_t fnv_prime = 1099511628211ull;

    uint64_t hash = fnv_offset_basis;
    for (unsigned char c : normalized_vital_part)
    {
        hash ^= static_cast<uint64_t>(c);
        hash *= fnv_prime;
    }

    std::ostringstream out;
    out << "fnv1a64:";
    out << std::hex << std::setfill('0') << std::setw(16) << hash;
    return out.str();
}

FactoryHashLedgerEntry build_hash_ledger_entry(const std::string& creation_expression)
{
    FactoryHashLedgerEntry out;
    out.creation_expression = trim(creation_expression);
    out.normalized_vital_part = collapse_ascii_whitespace("return " + out.creation_expression + ";");
    out.hash_id = make_vital_part_hash_id(out.normalized_vital_part);
    return out;
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

} // namespace creational_codegen_internal
