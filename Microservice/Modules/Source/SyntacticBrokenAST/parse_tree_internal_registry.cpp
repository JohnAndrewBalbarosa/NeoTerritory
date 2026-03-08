#include "Internal/parse_tree_internal.hpp"

#include "language_tokens.hpp"
#include "lexical_structure_hooks.hpp"

#include <functional>
#include <string>
#include <utility>
#include <vector>

namespace parse_tree_internal
{
void register_classes_in_line(
    const std::string& file_path,
    const std::vector<std::string>& line_tokens,
    const ParseTreeBuildContext& context,
    StructuralAnalysisState& structural_state,
    ClassHashRegistry& class_hash_registry)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    for (size_t i = 0; i + 1 < line_tokens.size(); ++i)
    {
        const std::string kw = lowercase_ascii(line_tokens[i]);
        if (cfg.class_keywords.find(kw) == cfg.class_keywords.end())
        {
            continue;
        }

        const std::string class_name = line_tokens[i + 1];
        const size_t class_hash = std::hash<std::string>{}(class_name);

        bool already_registered = false;
        std::vector<RegisteredClassSymbol>& bucket = class_hash_registry[class_hash];
        for (const RegisteredClassSymbol& item : bucket)
        {
            if (item.class_name == class_name && item.file_path == file_path)
            {
                already_registered = true;
                break;
            }
        }

        if (!already_registered)
        {
            RegisteredClassSymbol symbol;
            symbol.class_name = class_name;
            symbol.file_path = file_path;
            symbol.class_name_hash = class_hash;
            symbol.contextual_hash = hash_class_name_with_file(file_path, class_name);
            bucket.push_back(std::move(symbol));
        }
        on_class_scanned_structural_hook(class_name, line_tokens, context, structural_state);
    }
}

bool token_hits_registered_class(
    const std::string& token,
    const ClassHashRegistry& class_hash_registry,
    size_t& out_class_hash,
    bool& out_collision,
    size_t* out_matched_context_hash)
{
    out_class_hash = std::hash<std::string>{}(token);
    const auto hit = class_hash_registry.find(out_class_hash);
    if (hit == class_hash_registry.end())
    {
        return false;
    }

    size_t exact_name_matches = 0;
    size_t matched_context_hash = 0;
    for (const RegisteredClassSymbol& symbol : hit->second)
    {
        if (symbol.class_name == token)
        {
            ++exact_name_matches;
            if (matched_context_hash == 0)
            {
                matched_context_hash = symbol.contextual_hash;
            }
        }
    }

    if (out_matched_context_hash != nullptr)
    {
        *out_matched_context_hash = matched_context_hash;
    }

    out_collision = exact_name_matches != 1 || hit->second.size() > exact_name_matches;
    return exact_name_matches > 0;
}

void collect_line_hash_trace(
    const std::string& file_path,
    size_t line_number,
    const std::vector<std::string>& line_tokens,
    size_t hit_token_index,
    size_t class_hash,
    size_t matched_class_context_hash,
    bool hash_collision,
    size_t scope_hash,
    std::vector<LineHashTrace>& line_hash_traces)
{
    if (line_tokens.empty() || hit_token_index >= line_tokens.size())
    {
        return;
    }

    size_t current_hash = hash_combine_token(scope_hash, std::to_string(class_hash));
    std::vector<size_t> chain;

    for (size_t i = hit_token_index; i > 0; --i)
    {
        current_hash = hash_combine_token(current_hash, line_tokens[i - 1]);
        chain.push_back(current_hash);
    }
    for (size_t i = hit_token_index + 1; i < line_tokens.size(); ++i)
    {
        current_hash = hash_combine_token(current_hash, line_tokens[i]);
        chain.push_back(current_hash);
    }

    LineHashTrace trace;
    trace.file_path = file_path;
    trace.line_number = line_number;
    trace.class_name = line_tokens[hit_token_index];
    trace.class_name_hash = class_hash;
    trace.matched_class_contextual_hash = matched_class_context_hash;
    trace.hit_token_index = hit_token_index;
    trace.outgoing_hash = current_hash;
    trace.hash_collision = hash_collision;
    trace.dirty_token_count = line_tokens.size();
    trace.hash_chain = std::move(chain);
    line_hash_traces.push_back(std::move(trace));
}
} // namespace parse_tree_internal
