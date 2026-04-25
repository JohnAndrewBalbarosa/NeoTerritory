#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/ImplementationUse/Resolution/Symbols/Internal/core.hpp"

ParseTreeSymbolTables build_symbol_tables_with_builder(
    const ParseTreeNode&,
    SymbolTableBuilder&,
    const ParseTreeSymbolBuildOptions&)
{
    return {};
}
