#include "parse_tree_symbols.hpp"

#include "language_tokens.hpp"

#include <cctype>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace
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

struct SymbolTableBuilder
{
    explicit SymbolTableBuilder(ParseTreeSymbolBuildOptions opts)
        : options(std::move(opts))
    {
    }

    ParseTreeSymbolBuildOptions options;
    ParseTreeSymbolTables tables;

    std::unordered_map<std::string, std::vector<size_t>> class_name_index;
    std::unordered_map<size_t, std::vector<size_t>> class_name_hash_index;
    std::unordered_map<size_t, std::vector<size_t>> class_symbol_hash_index;
    std::unordered_map<size_t, size_t> class_context_hash_index;
    std::unordered_map<std::string, std::vector<size_t>> function_name_index;
    std::unordered_map<std::string, size_t> function_key_index;

    void add_class_symbol(
        const std::string& signature,
        const std::string& file_path,
        size_t definition_node_index,
        size_t node_contextual_hash)
    {
        const std::string name = class_name_from_signature(signature);
        if (name.empty())
        {
            return;
        }

        if (class_context_hash_index.find(node_contextual_hash) != class_context_hash_index.end())
        {
            return;
        }

        ParseSymbol s;
        s.name = name;
        s.signature = signature;
        s.file_path = file_path;
        s.owner_scope = "class";
        s.function_key.clear();
        s.name_hash = std::hash<std::string>{}(name);
        s.contextual_hash = node_contextual_hash;
        s.hash_value = std::hash<std::string>{}(file_path + "|" + name);
        s.definition_node_index = definition_node_index;

        class_name_index[name].push_back(tables.class_symbols.size());
        class_name_hash_index[s.name_hash].push_back(tables.class_symbols.size());
        class_symbol_hash_index[s.hash_value].push_back(tables.class_symbols.size());
        class_context_hash_index[s.contextual_hash] = tables.class_symbols.size();
        tables.class_symbols.push_back(std::move(s));
    }

    void add_function_symbol(
        const std::string& signature,
        const std::string& file_path,
        const std::string& owner_scope,
        size_t node_contextual_hash,
        size_t definition_node_index)
    {
        const std::string name = function_name_from_signature(signature);
        if (name.empty() || is_main_function_name(name))
        {
            return;
        }

        const std::string function_key = build_function_key(file_path, owner_scope, name, signature);
        if (function_key_index.find(function_key) != function_key_index.end())
        {
            return;
        }

        ParseSymbol s;
        s.name = name;
        s.signature = signature;
        s.file_path = file_path;
        s.owner_scope = owner_scope.empty() ? "global" : owner_scope;
        s.function_key = function_key;
        s.name_hash = std::hash<std::string>{}(name);
        s.contextual_hash = node_contextual_hash;
        s.hash_value = std::hash<std::string>{}(function_key);
        s.definition_node_index = definition_node_index;

        const size_t symbol_index = tables.function_symbols.size();
        tables.function_symbols.push_back(std::move(s));
        function_name_index[name].push_back(symbol_index);
        function_key_index[function_key] = symbol_index;
    }

    void collect_symbols_dfs(
        const ParseTreeNode& node,
        const std::string& current_file,
        const std::string& current_class_scope,
        size_t& node_index)
    {
        ++node_index;

        std::string file_scope = current_file;
        if (node.kind == "FileUnit")
        {
            file_scope = node.value;
        }

        std::string class_scope = current_class_scope;
        if (node.kind == "ClassDecl" || node.kind == "StructDecl" || is_class_block(node))
        {
            add_class_symbol(node.value, file_scope, node_index, node.contextual_hash);
            const std::string class_name = class_name_from_signature(node.value);
            if (!class_name.empty())
            {
                class_scope = class_name;
            }
        }

        if (is_function_block(node))
        {
            add_function_symbol(node.value, file_scope, class_scope, node.contextual_hash, node_index);
        }

        for (const ParseTreeNode& child : node.children)
        {
            collect_symbols_dfs(child, file_scope, class_scope, node_index);
        }
    }

    void collect_class_usages_dfs(const ParseTreeNode& node, const std::string& current_file, size_t& node_index)
    {
        ++node_index;

        std::string file_scope = current_file;
        if (node.kind == "FileUnit")
        {
            file_scope = node.value;
        }

        const bool declaration_node =
            (node.kind == "ClassDecl" || node.kind == "StructDecl" || is_class_block(node));

        if (is_candidate_usage_node(node))
        {
            const std::vector<std::string> words = split_words(node.value);
            for (const std::string& word : words)
            {
                const size_t class_name_hash = std::hash<std::string>{}(word);
                const auto hit = class_name_hash_index.find(class_name_hash);
                if (hit != class_name_hash_index.end())
                {
                    size_t exact_name_matches = 0;
                    bool exact_name_match = false;
                    for (size_t class_idx : hit->second)
                    {
                        if (class_idx < tables.class_symbols.size() && tables.class_symbols[class_idx].name == word)
                        {
                            ++exact_name_matches;
                            exact_name_match = true;
                        }
                    }

                    const bool hash_collision = !exact_name_match || hit->second.size() > exact_name_matches;
                    if (!(declaration_node && class_name_from_signature(node.value) == word))
                    {
                        ParseSymbolUsage usage;
                        usage.name = word;
                        usage.type_string = word;
                        usage.node_kind = node.kind;
                        usage.node_value = node.value;
                        usage.node_index = node_index;
                        usage.node_contextual_hash = node.contextual_hash;
                        usage.class_name_hash = class_name_hash;
                        usage.hash_value =
                            std::hash<std::string>{}(file_scope + "|" + std::to_string(node.contextual_hash) + "|" + word);
                        usage.refactor_candidate =
                            options.refactor_candidate_class_names.find(word) != options.refactor_candidate_class_names.end();
                        usage.hash_collision = hash_collision;
                        tables.class_usages.push_back(std::move(usage));
                    }
                }
            }
        }

        for (const ParseTreeNode& child : node.children)
        {
            collect_class_usages_dfs(child, file_scope, node_index);
        }
    }
};
} // namespace

ParseTreeSymbolTables build_parse_tree_symbol_tables(const ParseTreeNode& root, const ParseTreeSymbolBuildOptions& options)
{
    SymbolTableBuilder builder(options);

    size_t definition_node_index = 0;
    builder.collect_symbols_dfs(root, "", "", definition_node_index);

    size_t usage_node_index = 0;
    builder.collect_class_usages_dfs(root, "", usage_node_index);

    return builder.tables;
}

const std::vector<ParseSymbol>& class_symbol_table(const ParseTreeSymbolTables& tables)
{
    return tables.class_symbols;
}

const std::vector<ParseSymbol>& function_symbol_table(const ParseTreeSymbolTables& tables)
{
    return tables.function_symbols;
}

const std::vector<ParseSymbolUsage>& class_usage_table(const ParseTreeSymbolTables& tables)
{
    return tables.class_usages;
}

const ParseSymbol* find_class_by_name(const ParseTreeSymbolTables& tables, const std::string& name)
{
    for (const ParseSymbol& symbol : tables.class_symbols)
    {
        if (symbol.name == name)
        {
            return &symbol;
        }
    }
    return nullptr;
}

const ParseSymbol* find_class_by_hash(const ParseTreeSymbolTables& tables, size_t hash_value)
{
    for (const ParseSymbol& symbol : tables.class_symbols)
    {
        if (symbol.contextual_hash == hash_value || symbol.hash_value == hash_value || symbol.name_hash == hash_value)
        {
            return &symbol;
        }
    }
    return nullptr;
}

const ParseSymbol* find_function_by_name(const ParseTreeSymbolTables& tables, const std::string& name)
{
    for (const ParseSymbol& symbol : tables.function_symbols)
    {
        if (symbol.name == name)
        {
            return &symbol;
        }
    }
    return nullptr;
}

const ParseSymbol* find_function_by_key(const ParseTreeSymbolTables& tables, const std::string& function_key)
{
    for (const ParseSymbol& symbol : tables.function_symbols)
    {
        if (symbol.function_key == function_key)
        {
            return &symbol;
        }
    }
    return nullptr;
}

std::vector<const ParseSymbol*> find_functions_by_name(const ParseTreeSymbolTables& tables, const std::string& name)
{
    std::vector<const ParseSymbol*> out;
    for (const ParseSymbol& symbol : tables.function_symbols)
    {
        if (symbol.name == name)
        {
            out.push_back(&symbol);
        }
    }
    return out;
}

std::vector<ParseSymbolUsage> find_class_usages_by_name(const ParseTreeSymbolTables& tables, const std::string& name)
{
    std::vector<ParseSymbolUsage> out;
    for (const ParseSymbolUsage& usage : tables.class_usages)
    {
        if (usage.name == name)
        {
            out.push_back(usage);
        }
    }
    return out;
}

bool return_targets_known_class(const ParseTreeSymbolTables& tables, const std::string& return_expression)
{
    const std::string candidate = extract_return_candidate_name(return_expression);
    if (candidate.empty())
    {
        return false;
    }

    return find_class_by_name(tables, candidate) != nullptr;
}
