#include "Trees/Actual/parse_tree.hpp"
#include "Trees/Actual/Internal/contracts.hpp"
#include "Analysis/Lexical/token_stream.hpp"

#include <cstddef>
#include <string>
#include <utility>
#include <vector>

namespace
{
struct TokenCursor
{
    const std::vector<LexicalToken>* tokens = nullptr;
    std::size_t                       index  = 0;

    bool eof() const { return !tokens || index >= tokens->size(); }
    const LexicalToken& peek(std::size_t offset = 0) const { return (*tokens)[index + offset]; }
    void advance() { ++index; }
};

bool token_is(const LexicalToken& token, LexicalTokenKind kind, const std::string& lexeme)
{
    return token.kind == kind && token.lexeme == lexeme;
}

std::size_t find_matching_brace(const std::vector<LexicalToken>& tokens, std::size_t open_index)
{
    int depth = 0;
    for (std::size_t i = open_index; i < tokens.size(); ++i)
    {
        const LexicalToken& token = tokens[i];
        if (token.kind != LexicalTokenKind::Punctuation) continue;
        if (token.lexeme == "{") ++depth;
        else if (token.lexeme == "}")
        {
            --depth;
            if (depth == 0) return i;
        }
    }
    return tokens.size();
}

std::size_t find_matching_paren(const std::vector<LexicalToken>& tokens, std::size_t open_index)
{
    int depth = 0;
    for (std::size_t i = open_index; i < tokens.size(); ++i)
    {
        const LexicalToken& token = tokens[i];
        if (token.kind != LexicalTokenKind::Punctuation) continue;
        if (token.lexeme == "(") ++depth;
        else if (token.lexeme == ")")
        {
            --depth;
            if (depth == 0) return i;
        }
    }
    return tokens.size();
}

std::vector<std::string> extract_parameter_types(
    const std::vector<LexicalToken>& tokens,
    std::size_t                      open_paren,
    std::size_t                      close_paren)
{
    std::vector<std::string> types;
    std::string              current;
    int                      paren_depth = 0;
    int                      angle_depth = 0;

    for (std::size_t i = open_paren + 1; i < close_paren; ++i)
    {
        const LexicalToken& token = tokens[i];
        if (token.kind == LexicalTokenKind::Punctuation)
        {
            if (token.lexeme == "(") ++paren_depth;
            else if (token.lexeme == ")") --paren_depth;
            else if (token.lexeme == ",")
            {
                if (paren_depth == 0 && angle_depth == 0)
                {
                    if (!current.empty()) types.push_back(current);
                    current.clear();
                    continue;
                }
            }
        }
        else if (token.kind == LexicalTokenKind::Operator)
        {
            if (token.lexeme == "<") ++angle_depth;
            else if (token.lexeme == ">") --angle_depth;
        }

        if (!current.empty() && token.kind != LexicalTokenKind::Punctuation) current.push_back(' ');
        if (current.empty() || current.back() != ' ' || !token.lexeme.empty())
        {
            current += token.lexeme;
        }
    }
    if (!current.empty()) types.push_back(current);
    return types;
}

std::size_t hash_function_identity(
    std::size_t                     class_hash,
    const std::string&              method_name,
    const std::vector<std::string>& parameter_types)
{
    std::size_t key = hash_combine_token(class_hash, method_name);
    for (const std::string& param_type : parameter_types)
    {
        key = hash_combine_token(key, param_type);
    }
    return key;
}

// Walk the optional `: access Base[, …]` clause that appears between the
// class name and the opening brace. Stops at `{` or `;`. Tolerates
// `class Foo final : public Bar`, virtual inheritance, qualified base
// names (Ns::Bar), and templated bases (best-effort: stores the head
// identifier of the base type, since the structural matcher only needs
// the unqualified short name to resolve against the class registry).
std::vector<BaseSpec> extract_base_specs(
    const std::vector<LexicalToken>& tokens,
    std::size_t                      after_name,
    std::size_t                      brace_or_semi,
    bool                             is_struct_default)
{
    std::vector<BaseSpec> bases;
    std::size_t           i = after_name;
    while (i < brace_or_semi &&
           !token_is(tokens[i], LexicalTokenKind::Punctuation, ":"))
    {
        ++i;
    }
    if (i >= brace_or_semi) return bases;
    ++i; // skip ':'

    while (i < brace_or_semi)
    {
        BaseSpec spec;
        spec.access = is_struct_default ? BaseAccessKind::Public : BaseAccessKind::Private;

        // Access / virtual qualifiers can appear in any order before the name.
        bool consuming_qualifiers = true;
        while (consuming_qualifiers && i < brace_or_semi)
        {
            const LexicalToken& t = tokens[i];
            if (t.kind == LexicalTokenKind::Keyword)
            {
                if      (t.lexeme == "public")    { spec.access = BaseAccessKind::Public;    ++i; continue; }
                else if (t.lexeme == "protected") { spec.access = BaseAccessKind::Protected; ++i; continue; }
                else if (t.lexeme == "private")   { spec.access = BaseAccessKind::Private;   ++i; continue; }
                else if (t.lexeme == "virtual")   { spec.virtual_inheritance = true;         ++i; continue; }
            }
            consuming_qualifiers = false;
        }

        // Capture the base name. Resolve qualified names (A::B::Bar) by taking
        // the trailing identifier — the structural matcher resolves bases
        // against the file-local class registry, which keys on short names.
        std::string base_name;
        while (i < brace_or_semi)
        {
            const LexicalToken& t = tokens[i];
            if (t.kind == LexicalTokenKind::Identifier)
            {
                base_name = t.lexeme;
                ++i;
                continue;
            }
            if (t.kind == LexicalTokenKind::Operator && t.lexeme == "::")
            {
                ++i;
                continue;
            }
            break;
        }

        // Skip a templated tail `<…>` so we don't trip on its commas.
        if (i < brace_or_semi &&
            tokens[i].kind == LexicalTokenKind::Operator &&
            tokens[i].lexeme == "<")
        {
            int depth = 0;
            while (i < brace_or_semi)
            {
                const LexicalToken& t = tokens[i];
                if (t.kind == LexicalTokenKind::Operator && t.lexeme == "<") ++depth;
                else if (t.kind == LexicalTokenKind::Operator && t.lexeme == ">")
                {
                    --depth;
                    ++i;
                    if (depth == 0) break;
                    continue;
                }
                ++i;
            }
        }

        if (!base_name.empty())
        {
            spec.name = std::move(base_name);
            bases.push_back(std::move(spec));
        }

        // Move past trailing comma to the next base, or stop at brace/semi.
        while (i < brace_or_semi &&
               !token_is(tokens[i], LexicalTokenKind::Punctuation, ","))
        {
            ++i;
        }
        if (i < brace_or_semi) ++i; // skip ','
    }
    return bases;
}

std::string slice_text(const std::vector<LexicalToken>& tokens, std::size_t from, std::size_t to)
{
    std::string text;
    for (std::size_t i = from; i < to && i < tokens.size(); ++i)
    {
        if (!text.empty()) text.push_back(' ');
        text += tokens[i].lexeme;
    }
    return text;
}

void parse_class_body(
    const std::vector<LexicalToken>& tokens,
    std::size_t                      body_open,
    std::size_t                      body_close,
    std::size_t                      class_hash,
    const std::string&               file_name,
    ParseTreeNode&                   class_node)
{
    std::size_t i = body_open + 1;
    while (i < body_close)
    {
        const LexicalToken& token = tokens[i];

        if (token_is(token, LexicalTokenKind::Punctuation, "{"))
        {
            i = find_matching_brace(tokens, i) + 1;
            continue;
        }

        if (token.kind == LexicalTokenKind::Identifier &&
            i + 1 < body_close &&
            token_is(tokens[i + 1], LexicalTokenKind::Punctuation, "("))
        {
            const std::size_t open_paren = i + 1;
            const std::size_t close_paren = find_matching_paren(tokens, open_paren);
            if (close_paren >= body_close) { ++i; continue; }

            const std::vector<std::string> parameter_types =
                extract_parameter_types(tokens, open_paren, close_paren);

            ParseTreeNode method_node;
            method_node.kind        = "MethodDecl";
            method_node.name        = token.lexeme;
            method_node.file_name   = file_name;
            method_node.line        = token.line;
            method_node.column      = token.column;
            method_node.hash        = hash_function_identity(class_hash, token.lexeme, parameter_types);
            method_node.parent_hash = class_hash;
            method_node.text        = slice_text(tokens, i, close_paren + 1);
            class_node.children.push_back(std::move(method_node));

            std::size_t after_paren = close_paren + 1;
            while (after_paren < body_close)
            {
                const LexicalToken& next = tokens[after_paren];
                if (token_is(next, LexicalTokenKind::Punctuation, "{"))
                {
                    after_paren = find_matching_brace(tokens, after_paren) + 1;
                    break;
                }
                if (token_is(next, LexicalTokenKind::Punctuation, ";"))
                {
                    after_paren += 1;
                    break;
                }
                ++after_paren;
            }
            i = after_paren;
            continue;
        }

        ++i;
    }
}

ParseTreeNode build_file_unit_tree(const SourceFileUnit& source)
{
    ParseTreeNode file_node;
    file_node.kind      = "FileUnit";
    file_node.name      = file_basename(source.file_name);
    file_node.file_name = source.file_name;
    file_node.hash      = make_fnv1a64_hash_id(source.file_name);

    const std::vector<LexicalToken> tokens = tokenize_cpp_source(source.contents);

    for (std::size_t i = 0; i < tokens.size(); ++i)
    {
        const LexicalToken& token = tokens[i];
        if (!(token.kind == LexicalTokenKind::Keyword &&
              (token.lexeme == "class" || token.lexeme == "struct")))
        {
            continue;
        }

        std::size_t name_index = i + 1;
        while (name_index < tokens.size() &&
               tokens[name_index].kind != LexicalTokenKind::Identifier &&
               !token_is(tokens[name_index], LexicalTokenKind::Punctuation, "{") &&
               !token_is(tokens[name_index], LexicalTokenKind::Punctuation, ";"))
        {
            ++name_index;
        }
        if (name_index >= tokens.size()) break;
        if (tokens[name_index].kind != LexicalTokenKind::Identifier) { i = name_index; continue; }

        const std::string class_name = tokens[name_index].lexeme;

        std::size_t open_brace = name_index + 1;
        while (open_brace < tokens.size() &&
               !token_is(tokens[open_brace], LexicalTokenKind::Punctuation, "{") &&
               !token_is(tokens[open_brace], LexicalTokenKind::Punctuation, ";"))
        {
            ++open_brace;
        }
        if (open_brace >= tokens.size()) break;
        if (token_is(tokens[open_brace], LexicalTokenKind::Punctuation, ";")) { i = open_brace; continue; }

        const std::size_t close_brace = find_matching_brace(tokens, open_brace);
        if (close_brace >= tokens.size()) break;

        ParseTreeNode class_node;
        class_node.kind        = (token.lexeme == "class") ? std::string("ClassDecl") : std::string("StructDecl");
        class_node.name        = class_name;
        class_node.file_name   = source.file_name;
        class_node.line        = tokens[name_index].line;
        class_node.column      = tokens[name_index].column;
        class_node.hash        = hash_class_name_with_file(class_name, source.file_name);
        class_node.parent_hash = file_node.hash;
        class_node.text        = slice_text(tokens, i, close_brace + 1);
        class_node.bases       = extract_base_specs(
            tokens, name_index + 1, open_brace, token.lexeme == "struct");

        parse_class_body(tokens, open_brace, close_brace, class_node.hash, source.file_name, class_node);
        file_node.children.push_back(std::move(class_node));

        i = close_brace;
    }
    return file_node;
}
} // namespace

ParseTreeNode build_cpp_parse_tree(const SourceFileUnit& source, const ParseTreeBuildContext&)
{
    return build_file_unit_tree(source);
}

ParseTreeBundle build_cpp_parse_trees(
    const std::vector<SourceFileUnit>& sources,
    const ParseTreeBuildContext&       context)
{
    ParseTreeBundle bundle;
    bundle.per_file_roots.reserve(sources.size());
    for (const SourceFileUnit& source : sources)
    {
        bundle.per_file_roots.push_back(build_cpp_parse_tree(source, context));
    }
    return bundle;
}

std::string parse_tree_to_text(const ParseTreeNode& root)
{
    std::string out;
    auto recurse = [&](const ParseTreeNode& node, std::size_t depth, auto& self) -> void {
        for (std::size_t i = 0; i < depth; ++i) out += "  ";
        out += node.kind;
        if (!node.name.empty()) { out += " "; out += node.name; }
        out += "\n";
        for (const ParseTreeNode& child : node.children) self(child, depth + 1, self);
    };
    recurse(root, 0, recurse);
    return out;
}

std::string parse_tree_to_html(const ParseTreeNode& root)
{
    std::string out;
    out += "<ul>";
    auto recurse = [&](const ParseTreeNode& node, auto& self) -> void {
        out += "<li>";
        out += "<span class=\"node-kind\">";
        out += node.kind;
        out += "</span>";
        if (!node.name.empty())
        {
            out += " <span class=\"node-name\">";
            out += node.name;
            out += "</span>";
        }
        if (!node.children.empty())
        {
            out += "<ul>";
            for (const ParseTreeNode& child : node.children) self(child, self);
            out += "</ul>";
        }
        out += "</li>";
    };
    recurse(root, recurse);
    out += "</ul>";
    return out;
}
