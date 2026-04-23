#include "parse_tree_symbols.hpp"

#include "Internal/parse_tree_symbols_internal.hpp"

ParseTreeSymbolTables build_parse_tree_symbol_tables(
    const ParseTreeNode& root,
    const ParseTreeSymbolBuildOptions& options)
{
    return parse_tree_symbols_internal::build_symbol_tables_with_builder(root, options);
}
