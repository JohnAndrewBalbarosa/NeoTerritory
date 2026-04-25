#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"

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
    const ParseTreeSymbolTables&,
    const std::string&,
    const std::string&)
{
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
    const ParseTreeSymbolTables&,
    const std::string&,
    std::size_t,
    const std::vector<std::string>&)
{
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
    const ParseTreeSymbolTables&,
    const std::string&)
{
    return {};
}

std::vector<ParseSymbolUsage> find_class_usages_by_name(
    const ParseTreeSymbolTables&,
    const std::string&,
    const std::string&)
{
    return {};
}

bool return_targets_known_class(
    const ParseTreeSymbolTables&,
    std::size_t)
{
    return false;
}
