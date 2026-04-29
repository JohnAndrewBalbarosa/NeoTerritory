#include "Analysis/Patterns/Catalog/matcher.hpp"

#include <algorithm>
#include <cstddef>
#include <cmath>
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

bool token_matches_evidence(const LexicalToken& token, const PatternEvidenceToken& expected)
{
    if (expected.expected_kind != LexicalTokenKind::Unknown && token.kind != expected.expected_kind)
    {
        return false;
    }
    if (!expected.lexeme_any_of.empty())
    {
        return std::find(expected.lexeme_any_of.begin(), expected.lexeme_any_of.end(), token.lexeme)
            != expected.lexeme_any_of.end();
    }
    return true;
}

bool match_evidence_rule_at(
    const PatternEvidenceRule& rule,
    const std::vector<LexicalToken>& tokens,
    std::size_t start,
    std::vector<std::size_t>* matched_indexes)
{
    if (rule.tokens.empty()) return false;
    std::size_t cursor = start;
    for (const PatternEvidenceToken& expected : rule.tokens)
    {
        if (rule.contiguous)
        {
            if (cursor >= tokens.size() || !token_matches_evidence(tokens[cursor], expected))
            {
                return false;
            }
            if (matched_indexes) matched_indexes->push_back(cursor);
            ++cursor;
            continue;
        }

        bool found = false;
        for (std::size_t i = cursor; i < tokens.size(); ++i)
        {
            if (token_matches_evidence(tokens[i], expected))
            {
                if (matched_indexes) matched_indexes->push_back(i);
                cursor = i + 1;
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    return true;
}

bool match_evidence_rule(
    const PatternEvidenceRule& rule,
    const std::vector<LexicalToken>& tokens,
    std::vector<std::size_t>* matched_indexes = nullptr)
{
    for (std::size_t i = 0; i < tokens.size(); ++i)
    {
        std::vector<std::size_t> local_indexes;
        if (match_evidence_rule_at(rule, tokens, i, &local_indexes))
        {
            if (matched_indexes) *matched_indexes = std::move(local_indexes);
            return true;
        }
    }
    return false;
}

double clamp01(double value)
{
    if (value < 0.0) return 0.0;
    if (value > 1.0) return 1.0;
    return value;
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

void score_rules(
    const std::vector<PatternEvidenceRule>& rules,
    const std::string& kind,
    const std::vector<LexicalToken>& tokens,
    double& score,
    double& possible,
    std::vector<PatternDocumentationAnchor>& anchors,
    std::vector<PatternEvidenceHit>& hits)
{
    for (const PatternEvidenceRule& rule : rules)
    {
        const double magnitude = std::abs(rule.weight);
        possible += magnitude;

        std::vector<std::size_t> matched_indexes;
        const bool matched = match_evidence_rule(rule, tokens, &matched_indexes);
        if (matched)
        {
            score += rule.weight;
            if (!rule.document_as.empty() && !matched_indexes.empty())
            {
                const LexicalToken& token = tokens[matched_indexes.front()];
                PatternDocumentationAnchor anchor;
                anchor.label       = rule.document_as;
                anchor.token_index = matched_indexes.front();
                anchor.line        = token.line;
                anchor.column      = token.column;
                anchor.lexeme      = token.lexeme;
                anchors.push_back(std::move(anchor));
            }
        }

        PatternEvidenceHit hit;
        hit.id      = rule.id;
        hit.kind    = kind;
        hit.weight  = rule.weight;
        hit.matched = matched;
        hits.push_back(std::move(hit));
    }
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

    const std::vector<LexicalToken>& tokens = class_stream.tokens;
    double required_possible = 0.0;
    double positive_possible = 0.0;
    double negative_possible = 0.0;

    score_rules(
        pattern.evidence_rules.required,
        "required",
        tokens,
        result.required_score,
        required_possible,
        state.documentation_anchors,
        result.evidence_hits);
    score_rules(
        pattern.evidence_rules.positive,
        "positive",
        tokens,
        result.evidence_score,
        positive_possible,
        state.documentation_anchors,
        result.evidence_hits);
    score_rules(
        pattern.evidence_rules.negative,
        "negative",
        tokens,
        result.negative_score,
        negative_possible,
        state.documentation_anchors,
        result.evidence_hits);

    const bool has_evidence_rules =
        required_possible > 0.0 || positive_possible > 0.0 || negative_possible > 0.0;
    const double required_fraction = required_possible > 0.0
        ? clamp01(result.required_score / required_possible)
        : 1.0;
    const double positive_fraction = positive_possible > 0.0
        ? clamp01(result.evidence_score / positive_possible)
        : 0.0;
    const double negative_penalty = negative_possible > 0.0
        ? clamp01(std::abs(result.negative_score) / negative_possible) * 0.35
        : 0.0;

    result.confidence = has_evidence_rules
        ? clamp01((0.65 * required_fraction) + (0.35 * positive_fraction) - negative_penalty)
        : 1.0;

    if (result.confidence < pattern.score_threshold)
    {
        result.matched = false;
        return result;
    }

    result.matched               = true;
    result.captures              = std::move(state.captures);
    result.documentation_anchors = std::move(state.documentation_anchors);
    return result;
}
