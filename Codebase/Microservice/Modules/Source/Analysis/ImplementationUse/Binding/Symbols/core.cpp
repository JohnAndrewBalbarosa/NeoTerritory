#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/ImplementationUse/Resolution/Symbols/Internal/core.hpp"

ParseTreeSymbolTables build_parse_tree_symbol_tables(
    const ParseTreeNode&               root,
    const ParseTreeSymbolBuildOptions& options)
{
    SymbolTableBuilder builder{};
    return build_symbol_tables_with_builder(root, builder, options);
}
