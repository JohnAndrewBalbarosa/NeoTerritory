#include "Analysis/Patterns/Catalog/matcher.hpp"

#include <algorithm>
#include <cstddef>
#include <utility>

namespace
{
struct MatchState
{
    const std::vector<LexicalToken>*           tokens   = nullptr;
    std::size_t                                cursor   = 0;
    std::vector<PatternCapture>                captures;
    std::vector<PatternDocumentationAnchor>    documentation_anchors;
};

bool token_matches_step(const LexicalToken& token, const PatternMatcherStep& step)
{
    if (step.expected_kind != LexicalTokenKind::Unknown && token.kind != step.expected_kind)
    {
        return false;
    }
    if (!step.expected_lexeme_any_of.empty())
    {
        bool any = false;
        for (const std::string& candidate : step.expected_lexeme_any_of)
        {
            if (candidate == token.lexeme) { any = true; break; }
        }
        if (!any) return false;
    }
    return true;
}

void record_capture(const PatternMatcherStep& step, const LexicalToken& token, std::size_t index, MatchState& state)
{
    if (!step.capture_as.empty())
    {
        PatternCapture capture;
        capture.capture_id = step.capture_as;
        capture.lexeme     = token.lexeme;
        capture.line       = token.line;
        capture.column     = token.column;
        state.captures.push_back(std::move(capture));
    }
    if (!step.document_as.empty())
    {
        PatternDocumentationAnchor anchor;
        anchor.label       = step.document_as;
        anchor.token_index = index;
        anchor.line        = token.line;
        anchor.column      = token.column;
        anchor.lexeme      = token.lexeme;
        state.documentation_anchors.push_back(std::move(anchor));
    }
}

bool try_match_step(const PatternMatcherStep& step, MatchState& state);

bool try_match_alternation(const PatternMatcherStep& step, MatchState& state)
{
    const std::size_t saved_cursor   = state.cursor;
    const std::size_t saved_captures = state.captures.size();
    const std::size_t saved_anchors  = state.documentation_anchors.size();

    for (const PatternMatcherStep& alt : step.one_of)
    {
        if (try_match_step(alt, state))
        {
            return true;
        }
        state.cursor = saved_cursor;
        state.captures.resize(saved_captures);
        state.documentation_anchors.resize(saved_anchors);
    }
    return false;
}

bool scan_forward_single(const PatternMatcherStep& step, MatchState& state)
{
    if (!step.one_of.empty())
    {
        return try_match_alternation(step, state);
    }

    const std::vector<LexicalToken>& tokens = *state.tokens;
    for (std::size_t i = state.cursor; i < tokens.size(); ++i)
    {
        if (token_matches_step(tokens[i], step))
        {
            record_capture(step, tokens[i], i, state);
            state.cursor = i + 1;
            return true;
        }
    }
    return false;
}

bool try_match_step(const PatternMatcherStep& step, MatchState& state)
{
    switch (step.repeat)
    {
        case PatternStepRepeat::Once:
        {
            return scan_forward_single(step, state);
        }
        case PatternStepRepeat::ZeroOrOne:
        {
            const std::size_t saved = state.cursor;
            if (!scan_forward_single(step, state))
            {
                state.cursor = saved;
            }
            return true;
        }
        case PatternStepRepeat::ZeroOrMore:
        {
            while (scan_forward_single(step, state)) {}
            return true;
        }
        case PatternStepRepeat::OneOrMore:
        {
            if (!scan_forward_single(step, state)) return false;
            while (scan_forward_single(step, state)) {}
            return true;
        }
    }
    return false;
}
} // namespace

PatternMatchResult match_pattern_against_class(
    const PatternTemplate&  pattern,
    const ClassTokenStream& class_stream)
{
    PatternMatchResult result;
    result.pattern_id     = pattern.pattern_id;
    result.pattern_family = pattern.pattern_family;
    result.pattern_name   = pattern.pattern_name;
    result.class_hash     = class_stream.class_hash;

    MatchState state;
    state.tokens = &class_stream.tokens;

    for (const PatternMatcherStep& step : pattern.ordered_checks)
    {
        if (try_match_step(step, state)) continue;
        if (step.optional) continue;
        result.matched = false;
        return result;
    }

    result.matched               = true;
    result.captures              = std::move(state.captures);
    result.documentation_anchors = std::move(state.documentation_anchors);
    return result;
}
