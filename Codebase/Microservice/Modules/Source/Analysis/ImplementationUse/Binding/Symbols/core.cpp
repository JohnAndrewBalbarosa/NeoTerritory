#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/ImplementationUse/Resolution/Symbols/Internal/core.hpp"
#include "Analysis/Lexical/token_stream.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <string>
#include <unordered_map>
#include <utility>

namespace
{
bool is_class_node(const ParseTreeNode& node)
{
    return node.kind == "ClassDecl" || node.kind == "StructDecl";
}

bool is_method_node(const ParseTreeNode& node)
{
    return node.kind == "MethodDecl";
}

void register_class(const ParseTreeNode& node, ParseTreeSymbolTables& tables)
{
    ParseSymbol symbol;
    symbol.actual_head  = &node;
    symbol.virtual_head = nullptr;
    tables.classes[node.hash] = symbol;
}

void register_function(const ParseTreeNode& node, ParseTreeSymbolTables& tables)
{
    ParseSymbol symbol;
    symbol.actual_head  = &node;
    symbol.virtual_head = nullptr;
    tables.functions[node.hash] = symbol;
}

void walk_for_declarations(const ParseTreeNode& node, ParseTreeSymbolTables& tables)
{
    if (is_class_node(node))
    {
        register_class(node, tables);
    }
    else if (is_method_node(node))
    {
        register_function(node, tables);
    }
    for (const ParseTreeNode& child : node.children)
    {
        walk_for_declarations(child, tables);
    }
}

void collect_method_usages(
    const ParseTreeNode&                                  method_node,
    const std::unordered_map<std::string, std::size_t>&   class_name_index,
    ParseTreeSymbolTables&                                tables)
{
    const std::vector<LexicalToken> tokens = tokenize_cpp_source(method_node.text);
    for (const LexicalToken& token : tokens)
    {
        if (token.kind != LexicalTokenKind::Identifier) continue;

        const auto it = class_name_index.find(token.lexeme);
        if (it == class_name_index.end()) continue;

        const std::size_t class_hash = it->second;
        if (class_hash == method_node.parent_hash) continue;

        ParseSymbolUsage usage;
        usage.usage_node          = &method_node;
        usage.containing_function = method_node.hash;
        tables.class_usages[class_hash].push_back(usage);
    }
}

void walk_for_usages(
    const ParseTreeNode&                                  node,
    const std::unordered_map<std::string, std::size_t>&   class_name_index,
    ParseTreeSymbolTables&                                tables)
{
    if (is_method_node(node))
    {
        collect_method_usages(node, class_name_index, tables);
    }
    for (const ParseTreeNode& child : node.children)
    {
        walk_for_usages(child, class_name_index, tables);
    }
}
} // namespace

ParseTreeSymbolTables build_parse_tree_symbol_tables(
    const ParseTreeNode&                root,
    const ParseTreeSymbolBuildOptions&  options)
{
    ParseTreeSymbolTables tables;
    walk_for_declarations(root, tables);

    // Build a name→hash index once and reuse it for both inheritance
    // resolution and (optionally) usage collection. Inheritance is part
    // of declaration data so it runs unconditionally, regardless of
    // collect_usages.
    std::unordered_map<std::string, std::size_t> class_name_index;
    class_name_index.reserve(tables.classes.size());
    for (const auto& kv : tables.classes)
    {
        const ParseSymbol& symbol = kv.second;
        if (!symbol.actual_head) continue;
        if (symbol.actual_head->name.empty()) continue;
        class_name_index.emplace(symbol.actual_head->name, kv.first);
    }

    // Resolve each class's bases against the registry. Unresolved
    // names are silently dropped from parent_hashes (they remain on
    // ParseTreeNode::bases for callers that want the original token).
    for (auto& kv : tables.classes)
    {
        ParseSymbol& symbol = kv.second;
        if (!symbol.actual_head) continue;
        for (const BaseSpec& base : symbol.actual_head->bases)
        {
            const auto it = class_name_index.find(base.name);
            if (it == class_name_index.end()) continue;
            const std::size_t parent_hash = it->second;
            if (parent_hash == kv.first) continue; // self-inheritance guard
            symbol.parent_hashes.push_back(parent_hash);
            tables.parents_to_children[parent_hash].push_back(kv.first);
        }
    }

    if (options.collect_usages && !class_name_index.empty())
    {
        walk_for_usages(root, class_name_index, tables);
    }

    return tables;
}
