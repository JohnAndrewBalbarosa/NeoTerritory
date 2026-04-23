#include "Internal/parse_tree_symbols_internal.hpp"

#include <string>
#include <vector>

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
    const std::string candidate = parse_tree_symbols_internal::extract_return_candidate_name(return_expression);
    if (candidate.empty())
    {
        return false;
    }

    return find_class_by_name(tables, candidate) != nullptr;
}
