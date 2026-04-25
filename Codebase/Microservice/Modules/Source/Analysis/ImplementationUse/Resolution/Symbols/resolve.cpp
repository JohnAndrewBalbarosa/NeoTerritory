#include "Analysis/ImplementationUse/Resolution/Symbols/Internal/core.hpp"

#include <cctype>
#include <sstream>

std::string trim(const std::string& text)
{
    std::size_t start = 0;
    std::size_t end   = text.size();
    while (start < end && std::isspace(static_cast<unsigned char>(text[start]))) ++start;
    while (end > start && std::isspace(static_cast<unsigned char>(text[end - 1]))) --end;
    return text.substr(start, end - start);
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    if (prefix.size() > text.size()) return false;
    return text.compare(0, prefix.size(), prefix) == 0;
}

std::vector<std::string> split_words(const std::string& text)
{
    std::vector<std::string> words;
    std::istringstream       stream(text);
    std::string              word;
    while (stream >> word)
    {
        words.push_back(word);
    }
    return words;
}

std::string class_name_from_signature(const std::string& signature)
{
    const std::vector<std::string> words = split_words(signature);
    for (std::size_t index = 0; index < words.size(); ++index)
    {
        if ((words[index] == "class" || words[index] == "struct") && index + 1 < words.size())
        {
            return words[index + 1];
        }
    }
    return {};
}

std::string function_name_from_signature(const std::string& signature)
{
    const std::size_t open_paren = signature.find('(');
    if (open_paren == std::string::npos) return {};
    std::size_t end = open_paren;
    while (end > 0 && std::isspace(static_cast<unsigned char>(signature[end - 1]))) --end;
    std::size_t start = end;
    while (start > 0)
    {
        const char ch = signature[start - 1];
        if (std::isalnum(static_cast<unsigned char>(ch)) || ch == '_' || ch == ':')
        {
            --start;
        }
        else
        {
            break;
        }
    }
    return signature.substr(start, end - start);
}

std::vector<std::string> function_parameter_hint_from_signature(const std::string& signature)
{
    const std::size_t open_paren  = signature.find('(');
    const std::size_t close_paren = signature.find(')', open_paren + 1);
    if (open_paren == std::string::npos || close_paren == std::string::npos)
    {
        return {};
    }
    std::string parameters_text = signature.substr(open_paren + 1, close_paren - open_paren - 1);
    std::vector<std::string> hints;
    std::string              current;
    for (char ch : parameters_text)
    {
        if (ch == ',')
        {
            hints.push_back(trim(current));
            current.clear();
        }
        else
        {
            current.push_back(ch);
        }
    }
    if (!current.empty())
    {
        hints.push_back(trim(current));
    }
    return hints;
}

std::size_t build_function_key(
    std::size_t                     parent_class_hash,
    const std::string&              function_name,
    const std::vector<std::string>& parameter_types)
{
    std::size_t key = parent_class_hash;
    const std::size_t name_hash = std::hash<std::string>{}(function_name);
    key ^= name_hash + 0x9e3779b97f4a7c15ULL + (key << 6) + (key >> 2);
    for (const std::string& parameter_type : parameter_types)
    {
        const std::size_t param_hash = std::hash<std::string>{}(parameter_type);
        key ^= param_hash + 0x9e3779b97f4a7c15ULL + (key << 6) + (key >> 2);
    }
    return key;
}

bool is_main_function_name(const std::string& name)
{
    return name == "main";
}

bool is_class_block(const ParseTreeNode& node)
{
    return node.kind == "class" || node.kind == "struct";
}

bool is_function_block(const ParseTreeNode& node)
{
    return node.kind == "function";
}

bool is_candidate_usage_node(const ParseTreeNode& node)
{
    return node.kind == "lexeme" || node.kind == "identifier";
}

std::string extract_return_candidate_name(const ParseTreeNode&)
{
    return {};
}
