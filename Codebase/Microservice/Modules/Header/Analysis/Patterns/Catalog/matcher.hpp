#pragma once

#include "Analysis/Lexical/token_stream.hpp"
#include "Analysis/Patterns/Catalog/catalog.hpp"

#include <cstddef>
#include <string>
#include <vector>

struct PatternCapture
{
    std::string capture_id;
    std::string lexeme;
    std::size_t line   = 0;
    std::size_t column = 0;
};

struct PatternDocumentationAnchor
{
    std::string label;
    std::size_t token_index = 0;
    std::size_t line        = 0;
    std::size_t column      = 0;
    std::string lexeme;
};

struct PatternMatchResult
{
    bool                                    matched = false;
    std::string                             pattern_id;
    std::string                             pattern_family;
    std::string                             pattern_name;
    std::size_t                             class_hash = 0;
    // Populated only on subclass-propagation matches (Step 5). Names the
    // tagged parent class whose inheritance-driven pattern triggered the
    // child match. Empty on regular per-class matches.
    std::string                             parent_class_name;
    std::vector<PatternCapture>             captures;
    std::vector<PatternDocumentationAnchor> documentation_anchors;
    // True when two or more patterns survived the ranking-pass strict
    // filter on the same class — see DESIGN_DECISIONS.md D38. The
    // ranking pass itself does no scoring or ranking; it only filters
    // (every surviving match is an equal candidate) and flags multi-
    // candidate classes via this bool so downstream consumers know the
    // class fits multiple patterns and should not pretend one won.
    bool                                    ambiguous      = false;
};

PatternMatchResult match_pattern_against_class(
    const PatternTemplate&  pattern,
    const ClassTokenStream& class_stream);
