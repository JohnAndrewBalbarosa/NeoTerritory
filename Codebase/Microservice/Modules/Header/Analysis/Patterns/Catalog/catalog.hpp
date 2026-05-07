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

// A negative signal that, when its regex matches the class or file text,
// penalises the match score. Signals with weight <= kHardRejectThreshold
// act as hard-rejects and suppress emission entirely.
struct NegativeSignal
{
    std::string id;
    std::string shape_regex;  // may contain {class_name} placeholder
    float       weight = 0.0f;
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
    SubclassRole                    subclass_role;
    std::string                     source_file;
    std::vector<NegativeSignal>     negative_signals;
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
};

PatternCatalog load_pattern_catalog(const std::string& catalog_directory);

PatternCatalog load_pattern_catalog_from_files(const std::vector<std::string>& json_files);

bool is_pattern_enabled(const PatternTemplate& pattern);
