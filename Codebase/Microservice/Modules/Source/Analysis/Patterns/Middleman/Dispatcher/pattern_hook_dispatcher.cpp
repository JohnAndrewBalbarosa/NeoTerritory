#include "OutputGeneration/Contracts/pipeline_state.hpp"

#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/Lexical/token_stream.hpp"
#include "Analysis/Patterns/Catalog/catalog.hpp"
#include "Analysis/Patterns/Catalog/matcher.hpp"
#include "Analysis/Patterns/Middleman/dispatcher.hpp"
#include "OutputGeneration/UnitTestGeneration/core.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <filesystem>
#include <unordered_map>
#include <utility>

namespace
{
// Strip the family prefix from a dotted pattern_id ("behavioural.strategy_interface"
// → "strategy_interface"). Returns the original string if no '.' is found.
std::string short_pattern_name(const std::string& pattern_id)
{
    const auto dot = pattern_id.find('.');
    if (dot == std::string::npos) return pattern_id;
    return pattern_id.substr(dot + 1);
}

bool is_inheritance_driven(
    const PatternCatalog& catalog,
    const std::string&    family,
    const std::string&    short_name)
{
    const auto it = catalog.inheritance_driven_patterns.find(family);
    if (it == catalog.inheritance_driven_patterns.end()) return false;
    for (const std::string& candidate : it->second)
    {
        if (candidate == short_name) return true;
    }
    return false;
}

// Resolve and lazy-load the child catalog for an inheritance-driven
// parent. Path layout: pattern_catalog/{family}/{short_name}/{child_catalog}.
// Cached in `cache` so multiple subclasses of the same parent reuse one
// parsed PatternTemplate. Returns nullptr if the catalog file is missing
// or empty.
const PatternTemplate* load_child_pattern_cached(
    const PatternCatalog&                                              parent_catalog,
    const PatternTemplate&                                             parent_template,
    std::unordered_map<std::string, PatternCatalog>&                   cache,
    std::vector<std::string>&                                          diagnostics)
{
    if (!parent_template.subclass_role.required) return nullptr;
    const std::string& child_filename =
        parent_template.subclass_role.child_catalog.empty()
            ? std::string("subclass.json")
            : parent_template.subclass_role.child_catalog;

    const std::string short_name = short_pattern_name(parent_template.pattern_id);
    const std::string cache_key  = parent_template.pattern_family + "/" + short_name;

    auto it = cache.find(cache_key);
    if (it == cache.end())
    {
        std::filesystem::path child_path =
            std::filesystem::path(parent_catalog.catalog_root) /
            parent_template.pattern_family /
            short_name /
            child_filename;
        std::error_code ec;
        if (!std::filesystem::exists(child_path, ec))
        {
            diagnostics.push_back("subclass_catalog_missing:" + child_path.string());
            cache.emplace(cache_key, PatternCatalog{}); // negative cache
            return nullptr;
        }
        PatternCatalog loaded = load_pattern_catalog_from_files({ child_path.string() });
        for (const std::string& diag : loaded.load_diagnostics)
        {
            diagnostics.push_back("subclass_load:" + diag);
        }
        it = cache.emplace(cache_key, std::move(loaded)).first;
    }

    if (it->second.patterns.empty()) return nullptr;
    return &it->second.patterns.front();
}

const ClassTokenStream* find_class_stream(
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

PatternDispatchOutput dispatch_patterns_against_subtrees(const PatternDispatchInput& input)
{
    PatternDispatchOutput output;
    if (input.catalog == nullptr || input.class_token_streams == nullptr)
    {
        output.diagnostics.push_back("dispatcher_missing_inputs");
        return output;
    }

    // Pass 1 — per-class structural matching, unchanged.
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

    // Pass 2 — subclass propagation. For each inheritance-driven parent
    // match, find subclasses via the symbol-table inheritance graph
    // (resolved by class name to bridge the two hash spaces:
    // class_token_streams use hash_class_identity() while
    // ParseTreeSymbolTables use hash_class_name_with_file()). Then run
    // the parent's child catalog against each subclass.
    if (input.symbol_tables == nullptr) return output;

    // Index loaded patterns by id so we can recover the parent template
    // (with its subclass_role) from a match's pattern_id.
    std::unordered_map<std::string, const PatternTemplate*> patterns_by_id;
    patterns_by_id.reserve(input.catalog->patterns.size());
    for (const PatternTemplate& pattern : input.catalog->patterns)
    {
        patterns_by_id.emplace(pattern.pattern_id, &pattern);
    }

    // children_by_parent_name maps "Vehicle" → ["Car", "Truck"]. Built
    // once from the symbol-table class entries: each class's
    // actual_head->bases lists its declared base classes by name, so we
    // invert that mapping here. This is hash-space-agnostic — works
    // regardless of which hash function the matcher's class_token_streams
    // happen to use.
    std::unordered_map<std::string, std::vector<std::string>> children_by_parent_name;
    for (const auto& kv : input.symbol_tables->classes)
    {
        const ParseSymbol& sym = kv.second;
        if (sym.actual_head == nullptr) continue;
        const std::string& child_name = sym.actual_head->name;
        if (child_name.empty()) continue;
        for (const BaseSpec& base : sym.actual_head->bases)
        {
            if (base.name.empty()) continue;
            children_by_parent_name[base.name].push_back(child_name);
        }
    }

    // Name → ClassTokenStream so we can run the child template against
    // the same token stream the matcher already prepared in pass 1.
    std::unordered_map<std::string, const ClassTokenStream*> streams_by_name;
    streams_by_name.reserve(input.class_token_streams->size());
    for (const ClassTokenStream& s : *input.class_token_streams)
    {
        streams_by_name.emplace(s.class_name, &s);
    }

    std::unordered_map<std::string, PatternCatalog> child_catalog_cache;
    const std::size_t pass1_size = output.matches.size();
    std::vector<PatternMatchResult> child_matches;

    for (std::size_t i = 0; i < pass1_size; ++i)
    {
        const PatternMatchResult& parent_match = output.matches[i];
        const std::string short_name = short_pattern_name(parent_match.pattern_id);
        if (!is_inheritance_driven(*input.catalog, parent_match.pattern_family, short_name))
        {
            continue;
        }

        const auto it_pat = patterns_by_id.find(parent_match.pattern_id);
        if (it_pat == patterns_by_id.end()) continue;
        const PatternTemplate* parent_template = it_pat->second;
        if (parent_template == nullptr) continue;

        const PatternTemplate* child_template = load_child_pattern_cached(
            *input.catalog, *parent_template, child_catalog_cache, output.diagnostics);
        if (child_template == nullptr) continue;

        // Recover parent class name from the matcher's stream (this is
        // also the lookup key into children_by_parent_name).
        std::string parent_class_name;
        if (const ClassTokenStream* parent_stream =
                find_class_stream(*input.class_token_streams, parent_match.class_hash))
        {
            parent_class_name = parent_stream->class_name;
        }
        if (parent_class_name.empty()) continue;

        const auto it_children = children_by_parent_name.find(parent_class_name);
        if (it_children == children_by_parent_name.end()) continue;

        for (const std::string& child_name : it_children->second)
        {
            const auto it_stream = streams_by_name.find(child_name);
            if (it_stream == streams_by_name.end()) continue;
            const ClassTokenStream* child_stream = it_stream->second;

            PatternMatchResult child_result =
                match_pattern_against_class(*child_template, *child_stream);
            if (!child_result.matched) continue;
            child_result.parent_class_name = parent_class_name;
            child_matches.push_back(std::move(child_result));
        }
    }

    for (PatternMatchResult& m : child_matches)
    {
        output.matches.push_back(std::move(m));
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
        tag.parent_class_name = match.parent_class_name;

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
