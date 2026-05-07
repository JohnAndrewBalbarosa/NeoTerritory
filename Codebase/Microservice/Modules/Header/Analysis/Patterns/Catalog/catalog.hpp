#pragma once

#include "Analysis/Lexical/token_stream.hpp"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

enum class PatternStepRepeat
{
    Once,
    ZeroOrOne,
    ZeroOrMore,
    OneOrMore,
};

struct PatternMatcherStep
{
    std::string                       id;
    LexicalTokenKind                  expected_kind   = LexicalTokenKind::Unknown;
    std::vector<std::string>          expected_lexeme_any_of;
    std::vector<PatternMatcherStep>   one_of;
    bool                              optional        = false;
    PatternStepRepeat                 repeat          = PatternStepRepeat::Once;
    std::string                       capture_as;
    std::string                       document_as;
};

// Optional declaration that this pattern is an inheritance-driven parent.
// Populated only when the pattern's JSON declares a `subclass_role` block;
// otherwise `required` stays false and the matcher skips child propagation.
struct SubclassRole
{
    bool        required = false;
    std::string parent_role;
    std::string child_role;
    std::string child_pattern_id;
    std::string child_catalog;       // filename relative to the parent's pattern folder, e.g. "subclass.json"
};

struct PatternTemplate
{
    std::string                     pattern_id;
    std::string                     pattern_family;
    std::string                     pattern_name;
    bool                            enabled = true;
    std::vector<PatternMatcherStep> ordered_checks;
    std::unordered_map<std::string, std::vector<std::string>> lexeme_identifiers;
    // Connotative signature categories — see DESIGN_DECISIONS.md D38.
    // Strict-AND filter: every category here must be satisfied by at
    // least one combo window in the class for the match to survive.
    std::vector<std::string>                signature_categories;
    // Negative signature categories — see DESIGN_DECISIONS.md D38.
    // Strict-NOR filter: if ANY category here fires in the class, the
    // pattern is rejected even if its positive signature_categories all
    // pass. Used to encode "this pattern explicitly does NOT have shape
    // X" without resorting to naming conventions.
    std::vector<std::string>                negative_signature_categories;
    SubclassRole                    subclass_role;
    std::string                     source_file;
};

struct PatternCatalog
{
    std::vector<PatternTemplate> patterns;
    std::string                  catalog_root;
    std::vector<std::string>     load_diagnostics;
    // Family-keyed list of pattern short names (no family prefix) authored
    // in pattern_catalog/inheritance_driven_patterns.json. Empty when the
    // masterlist is missing or malformed.
    std::unordered_map<std::string, std::vector<std::string>> inheritance_driven_patterns;
    // Connotative lexeme dictionary loaded from pattern_catalog/
    // lexeme_categories.json. category name -> list of combos. Each
    // combo is an ordered sequence of consecutive token lexemes that
    // together express the connotation. A single-token combo (size 1)
    // is permitted only for entries that are well-known stdlib API
    // symbols (`std::make_unique`, `std::lock_guard`, ...) where the
    // bare presence carries pattern meaning. Lone C++ keywords like
    // `this` or `->` MUST appear inside a multi-token combo (e.g.
    // [`return`, `*`, `this`]) and never as a single-token entry.
    // See DESIGN_DECISIONS.md D38.
    std::unordered_map<std::string, std::vector<std::vector<std::string>>> lexeme_categories;
};

PatternCatalog load_pattern_catalog(const std::string& catalog_directory);

PatternCatalog load_pattern_catalog_from_files(const std::vector<std::string>& json_files);

bool is_pattern_enabled(const PatternTemplate& pattern);
