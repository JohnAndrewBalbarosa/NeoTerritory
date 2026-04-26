#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Trees/Actual/parse_tree.hpp"

const std::unordered_map<std::size_t, ParseSymbol>& class_symbol_table(
    const ParseTreeSymbolTables& tables)
{
    return tables.classes;
}

const std::unordered_map<std::size_t, ParseSymbol>& function_symbol_table(
    const ParseTreeSymbolTables& tables)
{
    return tables.functions;
}

const std::unordered_map<std::size_t, std::vector<ParseSymbolUsage>>& class_usage_table(
    const ParseTreeSymbolTables& tables)
{
    return tables.class_usages;
}

const ParseSymbol* find_class_by_name(
    const ParseTreeSymbolTables& tables,
    const std::string&           name,
    const std::string&           file_name)
{
    for (const auto& kv : tables.classes)
    {
        const ParseSymbol& symbol = kv.second;
        if (!symbol.actual_head) continue;
        if (symbol.actual_head->name != name) continue;
        if (!file_name.empty() && symbol.actual_head->file_name != file_name) continue;
        return &kv.second;
    }
    return nullptr;
}

const ParseSymbol* find_class_by_hash(
    const ParseTreeSymbolTables& tables,
    std::size_t                  class_hash)
{
    auto iterator = tables.classes.find(class_hash);
    if (iterator == tables.classes.end())
    {
        return nullptr;
    }
    return &iterator->second;
}

const ParseSymbol* find_function_by_name(
    const ParseTreeSymbolTables&    tables,
    const std::string&              name,
    std::size_t                     parent_class_hash,
    const std::vector<std::string>&)
{
    for (const auto& kv : tables.functions)
    {
        const ParseSymbol& symbol = kv.second;
        if (!symbol.actual_head) continue;
        if (symbol.actual_head->name != name) continue;
        if (parent_class_hash != 0 &&
            symbol.actual_head->parent_hash != parent_class_hash) continue;
        return &kv.second;
    }
    return nullptr;
}

const ParseSymbol* find_function_by_key(
    const ParseTreeSymbolTables& tables,
    std::size_t                  function_hash)
{
    auto iterator = tables.functions.find(function_hash);
    if (iterator == tables.functions.end())
    {
        return nullptr;
    }
    return &iterator->second;
}

std::vector<const ParseSymbol*> find_functions_by_name(
    const ParseTreeSymbolTables& tables,
    const std::string&           name)
{
    std::vector<const ParseSymbol*> matches;
    for (const auto& kv : tables.functions)
    {
        const ParseSymbol& symbol = kv.second;
        if (!symbol.actual_head) continue;
        if (symbol.actual_head->name == name)
        {
            matches.push_back(&kv.second);
        }
    }
    return matches;
}

std::vector<ParseSymbolUsage> find_class_usages_by_name(
    const ParseTreeSymbolTables& tables,
    const std::string&           name,
    const std::string&           file_name)
{
    const ParseSymbol* class_symbol = find_class_by_name(tables, name, file_name);
    if (!class_symbol || !class_symbol->actual_head) return {};

    const std::size_t class_hash = class_symbol->actual_head->hash;
    auto iterator = tables.class_usages.find(class_hash);
    if (iterator == tables.class_usages.end()) return {};
    return iterator->second;
}

bool return_targets_known_class(
    const ParseTreeSymbolTables& tables,
    std::size_t                  function_hash)
{
    const ParseSymbol* function_symbol = find_function_by_key(tables, function_hash);
    if (!function_symbol || !function_symbol->actual_head) return false;

    const std::string& return_text = function_symbol->actual_head->text;
    if (return_text.empty()) return false;

    for (const auto& kv : tables.classes)
    {
        const ParseSymbol& class_symbol = kv.second;
        if (!class_symbol.actual_head) continue;
        const std::string& class_name = class_symbol.actual_head->name;
        if (class_name.empty()) continue;
        if (return_text.find(class_name) != std::string::npos) return true;
    }
    return false;
}
