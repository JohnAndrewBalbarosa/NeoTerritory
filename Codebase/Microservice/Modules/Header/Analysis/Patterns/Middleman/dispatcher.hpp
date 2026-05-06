#pragma once

#include "Analysis/Patterns/Catalog/catalog.hpp"
#include "Analysis/Patterns/Catalog/matcher.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

struct ClassTokenStream;
struct ParseTreeSymbolTables;

struct PatternDispatchInput
{
    const PatternCatalog*                       catalog            = nullptr;
    const std::vector<ClassTokenStream>*        class_token_streams = nullptr;
    const ParseTreeSymbolTables*                symbol_tables      = nullptr;
    std::vector<std::string>                    enabled_pattern_filter;
    std::string                                 full_source_text;
};

struct PatternDispatchOutput
{
    std::vector<PatternMatchResult> matches;
    std::vector<std::string>        diagnostics;
    std::size_t                     classes_examined = 0;
    std::size_t                     patterns_tried   = 0;
};

PatternDispatchOutput dispatch_patterns_against_subtrees(const PatternDispatchInput& input);
