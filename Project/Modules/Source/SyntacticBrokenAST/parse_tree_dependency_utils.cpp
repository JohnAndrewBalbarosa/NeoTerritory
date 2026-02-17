#include "parse_tree_dependency_utils.hpp"

#include "parse_tree_symbols.hpp"

#include <utility>

std::vector<DependencySymbolNode> collect_dependency_class_nodes(const ParseTreeNode& root)
{
    rebuild_parse_tree_symbol_tables(root);

    std::vector<DependencySymbolNode> out;
    const std::vector<ParseSymbol>& classes = getClassSymbolTable();
    out.reserve(classes.size());

    for (const ParseSymbol& cls : classes)
    {
        DependencySymbolNode node;
        node.name = cls.name;
        node.signature = cls.signature;
        node.hash_value = cls.hash_value;
        out.push_back(std::move(node));
    }

    return out;
}

std::vector<DependencySymbolNode> collect_dependency_function_nodes(const ParseTreeNode& root)
{
    rebuild_parse_tree_symbol_tables(root);

    std::vector<DependencySymbolNode> out;
    const std::vector<ParseSymbol>& functions = getFunctionSymbolTable();
    out.reserve(functions.size());

    for (const ParseSymbol& fn : functions)
    {
        DependencySymbolNode node;
        node.name = fn.name;
        node.signature = fn.signature;
        node.hash_value = fn.hash_value;
        out.push_back(std::move(node));
    }

    return out;
}
