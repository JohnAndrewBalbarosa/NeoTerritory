#include "Analysis/Patterns/Ranking/match_ranker.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

// See DESIGN_DECISIONS.md D38 — single-round, strict-AND, combo-based
// candidate filter. The connotation dictionary at lexeme_categories.json
// stores each category as a list of *combos*. A combo is an ordered
// sequence of consecutive token lexemes; a single-token combo is only
// permitted when its lexeme is a well-known stdlib API symbol (bare
// reserved keywords / operators are rejected at the dictionary level —
// see DESIGN_DECISIONS.md D38).
//
// A category is satisfied for a class when at least one of its combos
// matches a window of consecutive tokens in the class. A pattern
// survives the filter when ALL of its declared signature_categories are
// satisfied (logical AND). Surviving matches are equal candidates; if
// two or more survive on the same class, every survivor's `ambiguous`
// flag is set true. No scoring, no ranking.

namespace
{
bool combo_matches_at(
    const std::vector<LexicalToken>&  tokens,
    std::size_t                       start,
    const std::vector<std::string>&   combo)
{
    if (combo.empty()) return false;
    if (start + combo.size() > tokens.size()) return false;
    for (std::size_t k = 0; k < combo.size(); ++k)
    {
        if (tokens[start + k].lexeme != combo[k]) return false;
    }
    return true;
}

bool any_combo_fires_in_class(
    const std::vector<LexicalToken>&              tokens,
    const std::vector<std::vector<std::string>>&  combos)
{
    for (const std::vector<std::string>& combo : combos)
    {
        for (std::size_t i = 0; i + combo.size() <= tokens.size(); ++i)
        {
            if (combo_matches_at(tokens, i, combo)) return true;
        }
    }
    return false;
}

bool category_satisfied(
    const std::string&                                                       category_name,
    const std::vector<LexicalToken>&                                         tokens,
    const std::unordered_map<std::string, std::vector<std::vector<std::string>>>& dictionary)
{
    const auto it = dictionary.find(category_name);
    if (it == dictionary.end()) return false;
    return any_combo_fires_in_class(tokens, it->second);
}

bool pattern_passes_strict_filter(
    const PatternTemplate&                                                   pattern,
    const std::vector<LexicalToken>&                                         tokens,
    const std::unordered_map<std::string, std::vector<std::vector<std::string>>>& dictionary)
{
    // Empty signature_categories = pattern not yet opted into the
    // connotation rule. Pass through without extra filtering so the
    // existing ordered_checks gate stands alone.
    if (pattern.signature_categories.empty()) return true;

    for (const std::string& category : pattern.signature_categories)
    {
        if (!category_satisfied(category, tokens, dictionary)) return false;
    }
    return true;
}

const ClassTokenStream* find_stream(
    const std::vector<ClassTokenStream>& streams,
    std::size_t                          class_hash)
{
    for (const ClassTokenStream& s : streams)
    {
        if (s.class_hash == class_hash) return &s;
    }
    return nullptr;
}
} // namespace

void rank_pattern_matches(
    std::vector<PatternMatchResult>&     matches,
    const PatternCatalog*                catalog,
    const std::vector<ClassTokenStream>* class_token_streams,
    const ParseTreeSymbolTables*         symbol_tables)
{
    (void)symbol_tables; // grammar lives in the combos at this revision
    if (matches.empty()) return;

    static const std::unordered_map<std::string, std::vector<std::vector<std::string>>> kEmptyDict;
    const auto& dictionary = catalog ? catalog->lexeme_categories : kEmptyDict;

    std::unordered_map<std::string, const PatternTemplate*> pattern_by_id;
    if (catalog != nullptr)
    {
        for (const PatternTemplate& p : catalog->patterns)
        {
            pattern_by_id.emplace(p.pattern_id, &p);
        }
    }

    std::vector<PatternMatchResult> survivors;
    survivors.reserve(matches.size());
    for (PatternMatchResult& match : matches)
    {
        const ClassTokenStream* stream =
            class_token_streams != nullptr
                ? find_stream(*class_token_streams, match.class_hash)
                : nullptr;
        if (stream == nullptr) { survivors.push_back(std::move(match)); continue; }

        const auto pat_it = pattern_by_id.find(match.pattern_id);
        if (pat_it == pattern_by_id.end()) { survivors.push_back(std::move(match)); continue; }

        if (pattern_passes_strict_filter(*pat_it->second, stream->tokens, dictionary))
        {
            survivors.push_back(std::move(match));
        }
    }

    std::unordered_map<std::size_t, std::size_t> survivor_count_by_class;
    for (const PatternMatchResult& m : survivors)
    {
        ++survivor_count_by_class[m.class_hash];
    }
    for (PatternMatchResult& m : survivors)
    {
        m.ambiguous = survivor_count_by_class[m.class_hash] >= 2;
    }

    matches = std::move(survivors);
}
