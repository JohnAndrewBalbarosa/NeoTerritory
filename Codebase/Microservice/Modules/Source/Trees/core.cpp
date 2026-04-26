#include "OutputGeneration/Contracts/pipeline_state.hpp"

#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Analysis/Lexical/token_stream.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <cstddef>
#include <functional>
#include <string>
#include <utility>
#include <vector>

namespace
{
bool is_class_introducer(const LexicalToken& token)
{
    return token.kind == LexicalTokenKind::Keyword &&
           (token.lexeme == "class" || token.lexeme == "struct");
}

std::size_t find_class_brace_open(const std::vector<LexicalToken>& tokens, std::size_t from)
{
    for (std::size_t i = from; i < tokens.size(); ++i)
    {
        const LexicalToken& t = tokens[i];
        if (t.kind == LexicalTokenKind::Punctuation && t.lexeme == "{") return i;
        if (t.kind == LexicalTokenKind::Punctuation && t.lexeme == ";") return tokens.size();
    }
    return tokens.size();
}

std::size_t find_class_brace_close(const std::vector<LexicalToken>& tokens, std::size_t open_index)
{
    int depth = 0;
    for (std::size_t i = open_index; i < tokens.size(); ++i)
    {
        const LexicalToken& t = tokens[i];
        if (t.kind != LexicalTokenKind::Punctuation) continue;
        if (t.lexeme == "{") ++depth;
        else if (t.lexeme == "}")
        {
            --depth;
            if (depth == 0) return i;
        }
    }
    return tokens.size();
}

std::string find_class_name(const std::vector<LexicalToken>& tokens, std::size_t introducer_index)
{
    for (std::size_t i = introducer_index + 1; i < tokens.size(); ++i)
    {
        if (tokens[i].kind == LexicalTokenKind::Identifier) return tokens[i].lexeme;
        if (tokens[i].kind == LexicalTokenKind::Punctuation &&
            (tokens[i].lexeme == "{" || tokens[i].lexeme == ";"))
        {
            break;
        }
    }
    return {};
}

std::size_t hash_class_identity(const std::string& class_name, const std::string& file_name)
{
    const std::hash<std::string> hasher;
    const std::size_t name_hash = hasher(class_name);
    const std::size_t file_hash = hasher(file_name);
    return name_hash ^ (file_hash + 0x9e3779b97f4a7c15ull + (name_hash << 6) + (name_hash >> 2));
}

void extract_classes_from_file(
    const SourceFileUnit&           source,
    std::vector<ClassTokenStream>&  out_streams)
{
    const std::vector<LexicalToken> file_tokens = tokenize_cpp_source(source.contents);

    for (std::size_t i = 0; i < file_tokens.size(); ++i)
    {
        if (!is_class_introducer(file_tokens[i])) continue;

        const std::string class_name = find_class_name(file_tokens, i);
        if (class_name.empty()) continue;

        const std::size_t open_brace_index = find_class_brace_open(file_tokens, i);
        if (open_brace_index >= file_tokens.size()) continue;

        const std::size_t close_brace_index = find_class_brace_close(file_tokens, open_brace_index);
        if (close_brace_index >= file_tokens.size()) continue;

        ClassTokenStream stream;
        stream.class_hash = hash_class_identity(class_name, source.file_name);
        stream.file_name  = source.file_name;
        stream.tokens.assign(
            file_tokens.begin() + static_cast<std::ptrdiff_t>(i),
            file_tokens.begin() + static_cast<std::ptrdiff_t>(close_brace_index + 1));
        out_streams.push_back(std::move(stream));

        i = close_brace_index;
    }
}
} // namespace

void run_trees_stage(SourcePipelineState& state)
{
    const ParseTreeBundle bundle = build_cpp_parse_trees(state.source_files, state.build_context);
    state.per_file_roots      = bundle.per_file_roots;
    state.line_traces         = bundle.line_traces;
    state.factory_invocations = bundle.factory_invocations;

    state.main_tree.kind     = "TranslationUnit";
    state.main_tree.children = bundle.per_file_roots;

    state.class_token_streams.clear();
    for (const SourceFileUnit& source : state.source_files)
    {
        extract_classes_from_file(source, state.class_token_streams);
    }

    ParseTreeSymbolBuildOptions options;
    state.symbol_tables = build_parse_tree_symbol_tables(state.main_tree, options);
}
