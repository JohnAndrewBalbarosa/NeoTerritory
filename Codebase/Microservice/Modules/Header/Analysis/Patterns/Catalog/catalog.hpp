#pragma once

#include "Analysis/Lexical/token_stream.hpp"

#include <cstddef>
#include <string>
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

struct PatternTemplate
{
    std::string                     pattern_id;
    std::string                     pattern_family;
    std::string                     pattern_name;
    bool                            enabled = true;
    std::vector<PatternMatcherStep> ordered_checks;
    std::string                     source_file;
};

struct PatternCatalog
{
    std::vector<PatternTemplate> patterns;
    std::string                  catalog_root;
    std::vector<std::string>     load_diagnostics;
};

PatternCatalog load_pattern_catalog(const std::string& catalog_directory);

PatternCatalog load_pattern_catalog_from_files(const std::vector<std::string>& json_files);

bool is_pattern_enabled(const PatternTemplate& pattern);
