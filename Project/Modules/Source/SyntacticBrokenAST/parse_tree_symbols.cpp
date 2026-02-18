#include "parse_tree_symbols.hpp"
#include "language_tokens.hpp"

#include <algorithm>
#include <cctype>
#include <string>
#include <unordered_map>
#include <vector>

namespace
{
std::vector<ParseSymbol> g_class_symbols;
std::vector<ParseSymbol> g_function_symbols;
std::vector<ParseSymbolUsage> g_class_usages;
std::unordered_map<std::string, size_t> g_class_index;
std::unordered_map<std::string, size_t> g_function_index;

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

bool is_main_function_name(const std::string& name)
{
    return lowercase_ascii(name) == "main";
}

bool is_class_block(const ParseTreeNode& node)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = lowercase_ascii(trim(node.value));
    for (const std::string& kw : cfg.class_keywords)
    {
        if (starts_with(lowered, kw + " "))
        {
            return true;
        }
    }

    return false;
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

void add_class_symbol(const std::string& signature)
{
    const std::string name = class_name_from_signature(signature);
    if (name.empty() || g_class_index.find(name) != g_class_index.end())
    {
        return;
    }

    ParseSymbol s;
    s.name = name;
    s.signature = signature;
    s.hash_value = std::hash<std::string>{}(name);

    g_class_index[name] = g_class_symbols.size();
    g_class_symbols.push_back(std::move(s));
}

void add_function_symbol(const std::string& signature)
{
    const std::string name = function_name_from_signature(signature);
    if (name.empty() || is_main_function_name(name) || g_function_index.find(name) != g_function_index.end())
    {
        return;
    }

    ParseSymbol s;
    s.name = name;
    s.signature = signature;
    s.hash_value = std::hash<std::string>{}(name);

    g_function_index[name] = g_function_symbols.size();
    g_function_symbols.push_back(std::move(s));
}

void collect_symbols_dfs(const ParseTreeNode& node)
{
    if (node.kind == "ClassDecl" || node.kind == "StructDecl" || is_class_block(node))
    {
        add_class_symbol(node.value);
    }

    if (is_function_block(node))
    {
        add_function_symbol(node.value);
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_symbols_dfs(child);
    }
}

void collect_class_usages_dfs(const ParseTreeNode& node, size_t& node_index)
{
    ++node_index;

    const bool declaration_node =
        (node.kind == "ClassDecl" || node.kind == "StructDecl" || is_class_block(node));

    const std::vector<std::string> words = split_words(node.value);
    for (const std::string& word : words)
    {
        if (g_class_index.find(word) == g_class_index.end())
        {
            continue;
        }

        if (declaration_node)
        {
            const std::string declared_name = class_name_from_signature(node.value);
            if (declared_name == word)
            {
                continue;
            }
        }

        ParseSymbolUsage usage;
        usage.name = word;
        usage.node_kind = node.kind;
        usage.node_value = node.value;
        usage.node_index = node_index;
        usage.hash_value = std::hash<std::string>{}(word + ":" + std::to_string(node_index));
        g_class_usages.push_back(std::move(usage));
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_class_usages_dfs(child, node_index);
    }
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
} // namespace

void rebuild_parse_tree_symbol_tables(const ParseTreeNode& root)
{
    g_class_symbols.clear();
    g_function_symbols.clear();
    g_class_usages.clear();
    g_class_index.clear();
    g_function_index.clear();

    collect_symbols_dfs(root);

    size_t node_index = 0;
    collect_class_usages_dfs(root, node_index);
}

const std::vector<ParseSymbol>& getClassSymbolTable()
{
    return g_class_symbols;
}

const std::vector<ParseSymbol>& getFunctionSymbolTable()
{
    return g_function_symbols;
}

const std::vector<ParseSymbolUsage>& getClassUsageTable()
{
    return g_class_usages;
}

const ParseSymbol* getClassByName(const std::string& name)
{
    const auto it = g_class_index.find(name);
    if (it == g_class_index.end())
    {
        return nullptr;
    }

    return &g_class_symbols[it->second];
}

const ParseSymbol* getFunctionByName(const std::string& name)
{
    const auto it = g_function_index.find(name);
    if (it == g_function_index.end())
    {
        return nullptr;
    }

    return &g_function_symbols[it->second];
}

std::vector<ParseSymbolUsage> getClassUsagesByName(const std::string& name)
{
    std::vector<ParseSymbolUsage> out;
    for (const ParseSymbolUsage& usage : g_class_usages)
    {
        if (usage.name == name)
        {
            out.push_back(usage);
        }
    }
    return out;
}

bool returnTargetsKnownClass(const std::string& return_expression)
{
    const std::string candidate = extract_return_candidate_name(return_expression);
    if (candidate.empty())
    {
        return false;
    }

    return getClassByName(candidate) != nullptr;
}
