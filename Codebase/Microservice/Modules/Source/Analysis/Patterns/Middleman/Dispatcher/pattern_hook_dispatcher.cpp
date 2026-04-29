#include "OutputGeneration/Contracts/pipeline_state.hpp"

#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/Patterns/Catalog/catalog.hpp"
#include "Analysis/Patterns/Catalog/matcher.hpp"
#include "Analysis/Patterns/Middleman/dispatcher.hpp"
#include "OutputGeneration/UnitTestGeneration/core.hpp"
#include "Trees/Actual/parse_tree.hpp"

PatternDispatchOutput dispatch_patterns_against_subtrees(const PatternDispatchInput& input)
{
    PatternDispatchOutput output;
    if (input.catalog == nullptr || input.class_token_streams == nullptr)
    {
        output.diagnostics.push_back("dispatcher_missing_inputs");
        return output;
    }

    for (const ClassTokenStream& class_stream : *input.class_token_streams)
    {
        ++output.classes_examined;
        for (const PatternTemplate& pattern : input.catalog->patterns)
        {
            if (!is_pattern_enabled(pattern))
            {
                continue;
            }
            ++output.patterns_tried;

            PatternMatchResult result = match_pattern_against_class(pattern, class_stream);
            if (result.matched)
            {
                output.matches.push_back(std::move(result));
            }
        }
    }

    return output;
}

void run_pattern_dispatch_stage(SourcePipelineState& state)
{
    PatternDispatchInput input;
    input.catalog             = &state.pattern_catalog;
    input.class_token_streams = &state.class_token_streams;
    input.symbol_tables       = &state.symbol_tables;

    const PatternDispatchOutput output = dispatch_patterns_against_subtrees(input);
    state.pattern_matches = output.matches;

    for (const std::string& diag : output.diagnostics)
    {
        state.report.diagnostics.push_back(diag);
    }

    for (const PatternMatchResult& match : state.pattern_matches)
    {
        DesignPatternTag tag;
        tag.pattern_family    = match.pattern_family;
        tag.pattern_name      = match.pattern_name;
        tag.pattern_id        = match.pattern_id;
        tag.target_class_hash = match.class_hash;

        for (const ClassTokenStream& class_stream : state.class_token_streams)
        {
            if (class_stream.class_hash == match.class_hash)
            {
                tag.class_name = class_stream.class_name;
                tag.file_name  = class_stream.file_name;
                tag.class_text = class_stream.class_text;
                tag.unit_test_targets = extract_unit_test_targets(class_stream);
                break;
            }
        }

        for (const PatternDocumentationAnchor& anchor : match.documentation_anchors)
        {
            DocumentationTarget target;
            target.label     = anchor.label;
            target.node_hash = match.class_hash;
            target.line      = anchor.line;
            target.column    = anchor.column;
            target.lexeme    = anchor.lexeme;
            tag.documentation_targets.push_back(std::move(target));
        }
        state.report.detected_patterns.push_back(std::move(tag));
    }
}
