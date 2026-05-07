#include "Analysis/Patterns/Ranking/match_ranker.hpp"

#include <algorithm>
#include <cstddef>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// See DESIGN_DECISIONS.md D38 — single-round, strict-AND, grammar-aware
// candidate filter. No scoring, no ranking. A pattern survives the pass
// when ordered_checks said yes AND every entry in its
// signature_categories is satisfied by at least one token in the class
// whose surrounding token grammar matches the per-category rule. When
// signature_categories is empty, the match passes through (legacy
// patterns that have not opted into the connotation rule yet).
//
// Surviving matches are equal candidates — multiple per class is
// expected and they are not ordered. When two or more survive on the
// same class, every survivor's `ambiguous` flag is set to true so
// downstream consumers know the class fits multiple patterns.

namespace
{
using LexemeToCategories = std::unordered_map<std::string, std::vector<std::string>>;

LexemeToCategories build_lexeme_to_categories(
    const std::unordered_map<std::string, std::vector<std::string>>& categories)
{
    LexemeToCategories index;
    for (const auto& kv : categories)
    {
        for (const std::string& lexeme : kv.second)
        {
            index[lexeme].push_back(kv.first);
        }
    }
    return index;
}

bool token_in_category(
    const LexicalToken&        token,
    const std::string&         category,
    const LexemeToCategories&  lexeme_to_categories)
{
    const auto it = lexeme_to_categories.find(token.lexeme);
    if (it == lexeme_to_categories.end()) return false;
    for (const std::string& c : it->second)
    {
        if (c == category) return true;
    }
    return false;
}

bool category_present_anywhere(
    const std::vector<LexicalToken>&  tokens,
    const std::string&                category,
    const LexemeToCategories&         lexeme_to_categories)
{
    for (const LexicalToken& tok : tokens)
    {
        if (token_in_category(tok, category, lexeme_to_categories)) return true;
    }
    return false;
}

// object_instantiation — a category-member token that actually appears
// as the value being returned. Lookback up to 3 tokens for the `return`
// keyword so we catch `return new T()`, `return std::make_unique<T>()`,
// and `return make_shared<T>()`. Bare instantiation in a local
// initializer fails the grammar.
bool object_instantiation_in_return_position(
    const std::vector<LexicalToken>&  tokens,
    const LexemeToCategories&         lexeme_to_categories)
{
    for (std::size_t i = 0; i < tokens.size(); ++i)
    {
        if (!token_in_category(tokens[i], "object_instantiation", lexeme_to_categories))
        {
            continue;
        }
        const std::size_t lookback_start = i >= 3 ? i - 3 : 0;
        for (std::size_t j = lookback_start; j < i; ++j)
        {
            if (tokens[j].kind == LexicalTokenKind::Keyword &&
                tokens[j].lexeme == "return")
            {
                return true;
            }
        }
    }
    return false;
}

// self_return — strictly `return *this`. Bare `this` does not count.
bool self_return_grammar(const std::vector<LexicalToken>& tokens)
{
    for (std::size_t i = 2; i < tokens.size(); ++i)
    {
        if (tokens[i].lexeme != "this") continue;
        if (tokens[i - 1].lexeme != "*") continue;
        if (tokens[i - 2].kind == LexicalTokenKind::Keyword &&
            tokens[i - 2].lexeme == "return")
        {
            return true;
        }
    }
    return false;
}

// delegation_forward — `->` operator preceded by an Identifier, i.e.
// member access through a held pointer. Trailing return type `() -> T`
// (preceded by `)`) does not satisfy this shape.
bool delegation_forward_grammar(const std::vector<LexicalToken>& tokens)
{
    for (std::size_t i = 1; i < tokens.size(); ++i)
    {
        if (tokens[i].lexeme != "->") continue;
        if (tokens[i - 1].kind == LexicalTokenKind::Identifier) return true;
    }
    return false;
}

// destruction_signal — strictly `= delete` deletion. Bare `delete` (a
// delete-expression) does not count.
bool destruction_signal_grammar(const std::vector<LexicalToken>& tokens)
{
    for (std::size_t i = 1; i < tokens.size(); ++i)
    {
        if (!(tokens[i].kind == LexicalTokenKind::Keyword &&
              tokens[i].lexeme == "delete"))
        {
            continue;
        }
        if (tokens[i - 1].kind == LexicalTokenKind::Operator &&
            tokens[i - 1].lexeme == "=")
        {
            return true;
        }
    }
    return false;
}

bool category_satisfied(
    const std::string&                category,
    const std::vector<LexicalToken>&  tokens,
    const LexemeToCategories&         lexeme_to_categories)
{
    if (category == "object_instantiation")
    {
        return object_instantiation_in_return_position(tokens, lexeme_to_categories);
    }
    if (category == "self_return")
    {
        return self_return_grammar(tokens);
    }
    if (category == "delegation_forward")
    {
        return delegation_forward_grammar(tokens);
    }
    if (category == "destruction_signal")
    {
        return destruction_signal_grammar(tokens);
    }
    // static_storage_access, interface_polymorphism, access_control_caching,
    // ownership_handle, value_comparison — presence anywhere in the class
    // is sufficient. The lexeme set for these categories is restricted to
    // C++ keywords (already structural by construction) or stdlib API
    // symbols whose mere appearance carries pattern meaning.
    return category_present_anywhere(tokens, category, lexeme_to_categories);
}

bool pattern_passes_strict_filter(
    const PatternTemplate&            pattern,
    const std::vector<LexicalToken>&  tokens,
    const LexemeToCategories&         lexeme_to_categories)
{
    // Empty signature_categories = legacy pattern not yet opted into the
    // connotation rule. Pass through without extra filtering so the
    // existing ordered_checks gate stands alone.
    if (pattern.signature_categories.empty()) return true;

    // Strict AND — every declared signature category must be satisfied
    // (lexeme membership AND grammar shape) by at least one token.
    for (const std::string& category : pattern.signature_categories)
    {
        if (!category_satisfied(category, tokens, lexeme_to_categories)) return false;
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
    (void)symbol_tables; // grammar predicates are token-only at this revision
    if (matches.empty()) return;

    LexemeToCategories lexeme_to_categories;
    if (catalog != nullptr)
    {
        lexeme_to_categories = build_lexeme_to_categories(catalog->lexeme_categories);
    }

    std::unordered_map<std::string, const PatternTemplate*> pattern_by_id;
    if (catalog != nullptr)
    {
        for (const PatternTemplate& p : catalog->patterns)
        {
            pattern_by_id.emplace(p.pattern_id, &p);
        }
    }

    // Strict-filter pass — drop matches that fail the connotation rule.
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

        if (pattern_passes_strict_filter(*pat_it->second, stream->tokens,
                                         lexeme_to_categories))
        {
            survivors.push_back(std::move(match));
        }
    }

    // Ambiguity flag — true on every match whose class has 2+ survivors.
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
