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
    std::vector<PatternCapture>             captures;
    std::vector<PatternDocumentationAnchor> documentation_anchors;
};

PatternMatchResult match_pattern_against_class(
    const PatternTemplate&  pattern,
    const ClassTokenStream& class_stream);
