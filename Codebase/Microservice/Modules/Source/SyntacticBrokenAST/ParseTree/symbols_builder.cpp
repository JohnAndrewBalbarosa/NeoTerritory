#include "Internal/parse_tree_symbols_internal.hpp"

#include <cstddef>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace parse_tree_symbols_internal
{
namespace
{
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

ParseTreeSymbolTables build_symbol_tables_with_builder(
    const ParseTreeNode& root,
    const ParseTreeSymbolBuildOptions& options)
{
    SymbolTableBuilder builder(options);

    size_t definition_node_index = 0;
    builder.collect_symbols_dfs(root, "", "", definition_node_index);

    size_t usage_node_index = 0;
    builder.collect_class_usages_dfs(root, "", usage_node_index);

    return builder.tables;
}
} // namespace parse_tree_symbols_internal
