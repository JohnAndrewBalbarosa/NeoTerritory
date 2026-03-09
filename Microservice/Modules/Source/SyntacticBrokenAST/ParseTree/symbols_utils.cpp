#include "Internal/parse_tree_symbols_internal.hpp"

#include "language_tokens.hpp"

#include <cctype>
#include <string>
#include <vector>

namespace parse_tree_symbols_internal
{
std::string trim(const std::string& input)
{
    size_t start = 0;
    while (start < input.size() && std::isspace(static_cast<unsigned char>(input[start])))
    {
        ++start;
    }

    size_t end = input.size();
    while (end > start && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }

    return input.substr(start, end - start);
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
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

std::string class_name_from_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lowercase_ascii(words[i]);
        if (cfg.class_keywords.find(kw) != cfg.class_keywords.end())
        {
            return words[i + 1];
        }
    }

    return {};
}

std::string function_name_from_signature(const std::string& signature)
{
    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::string left = trim(trimmed.substr(0, open));
    const std::vector<std::string> words = split_words(left);
    if (words.empty())
    {
        return {};
    }

    return words.back();
}

std::string function_parameter_hint_from_signature(const std::string& signature)
{
    const size_t open = signature.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const size_t close = signature.find(')', open + 1);
    if (close == std::string::npos || close <= open + 1)
    {
        return {};
    }

    std::string out;
    out.reserve(close - open - 1);
    for (size_t i = open + 1; i < close; ++i)
    {
        const char c = signature[i];
        if (!std::isspace(static_cast<unsigned char>(c)))
        {
            out.push_back(c);
        }
    }
    return out;
}

std::string build_function_key(
    const std::string& file_path,
    const std::string& owner_scope,
    const std::string& function_name,
    const std::string& signature)
{
    const std::string scope = owner_scope.empty() ? "global" : owner_scope;
    const std::string params = function_parameter_hint_from_signature(signature);
    return file_path + "|" + scope + "|" + function_name + "|" + params;
}

bool is_main_function_name(const std::string& name)
{
    return lowercase_ascii(name) == "main";
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    return !class_name_from_signature(node.value).empty();
}

bool is_function_block(const ParseTreeNode& node)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string signature = trim(node.value);
    if (signature.empty() || signature.find('(') == std::string::npos || signature.find(')') == std::string::npos)
    {
        return false;
    }

    const std::vector<std::string> words = split_words(signature);
    if (words.empty())
    {
        return false;
    }

    const std::string first_word = lowercase_ascii(words.front());
    if (cfg.function_exclusion_keywords.find(first_word) != cfg.function_exclusion_keywords.end())
    {
        return false;
    }

    const std::string lowered = lowercase_ascii(signature);
    for (const std::string& kw : cfg.function_exclusion_keywords)
    {
        if (starts_with(lowered, kw + " ") || starts_with(lowered, kw + "("))
        {
            return false;
        }
    }

    return true;
}

bool is_candidate_usage_node(const ParseTreeNode& node)
{
    return !node.value.empty() &&
           node.kind != "IncludeDependency" &&
           node.kind != "SymbolDependency";
}

std::string extract_return_candidate_name(const std::string& return_expression)
{
    std::string expr = trim(return_expression);
    std::string lowered = lowercase_ascii(expr);

    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
        lowered = lowercase_ascii(expr);
    }

    if (starts_with(lowered, "new "))
    {
        expr = trim(expr.substr(4));
    }

    const std::vector<std::string> words = split_words(expr);
    if (words.empty())
    {
        return {};
    }

    return words.front();
}
} // namespace parse_tree_symbols_internal
