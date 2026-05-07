#pragma once

#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/Lexical/token_stream.hpp"
#include "Analysis/Patterns/Catalog/catalog.hpp"
#include "Analysis/Patterns/Catalog/matcher.hpp"

#include <vector>

// Single-round, strict-AND, grammar-aware candidate filter.
// See DESIGN_DECISIONS.md D38.
//
// Despite the historical "rank" name on this entry point and its module
// path, this pass does NO scoring and NO ranking. It strictly filters
// the matches list to those whose pattern's `signature_categories` are
// all satisfied (every declared category must have at least one token in
// the class that matches both the category lexeme set AND the per-
// category grammar rule). Surviving matches are equal candidates;
// matches that fail the strict filter are removed from `matches` (they
// were false positives the connotation rule explicitly rejects).
//
// When two or more matches on the same class survive, every survivor's
// `ambiguous` flag is set true so downstream consumers know the class
// fits multiple patterns and should not pretend one won.
//
// Empty signature_categories on a pattern means "not yet opted in" —
// the match passes through on its ordered_checks alone.
//
// `class_token_streams` may be null; in that case every match passes
// through unchanged. `symbol_tables` is currently unused by the grammar
// predicates and reserved for future structural rules.
void rank_pattern_matches(
    std::vector<PatternMatchResult>&     matches,
    const PatternCatalog*                catalog,
    const std::vector<ClassTokenStream>* class_token_streams,
    const ParseTreeSymbolTables*         symbol_tables);
