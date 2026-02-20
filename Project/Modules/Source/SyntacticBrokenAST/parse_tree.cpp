#include "parse_tree.hpp"
#include "lexical_structure_hooks.hpp"
#include "parse_tree_symbols.hpp"
#include "language_tokens.hpp"
#include "tree_html_renderer.hpp"

#include <cctype>
#include <functional>
#include <unordered_map>
#include <sstream>
#include <string>
#include <vector>

namespace
{
ParseTreeBuildContext g_build_context;
std::vector<LineHashTrace> g_line_hash_traces;

size_t hash_combine_token(size_t seed, const std::string& token)
{
    return std::hash<std::string>{}(std::to_string(seed) + "|" + token);
}

std::vector<std::string> tokenize_text(const std::string& source)
{
    std::vector<std::string> tokens;
    std::string current;

    auto flush_current = [&]() {
        if (!current.empty())
        {
            tokens.push_back(current);
            current.clear();
        }
    };

    for (size_t i = 0; i < source.size(); ++i)
    {
        const char c = source[i];

        if (std::isspace(static_cast<unsigned char>(c)))
        {
            flush_current();
            continue;
        }

        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
            continue;
        }

        flush_current();

        if ((c == ':' || c == '=' || c == '!' || c == '<' || c == '>') &&
            i + 1 < source.size() && source[i + 1] == '=')
        {
            tokens.emplace_back(source.substr(i, 2));
            ++i;
            continue;
        }

        if (c == ':' && i + 1 < source.size() && source[i + 1] == ':')
        {
            tokens.emplace_back("::");
            ++i;
            continue;
        }
        if (c == '-' && i + 1 < source.size() && source[i + 1] == '>')
        {
            tokens.emplace_back("->");
            ++i;
            continue;
        }

        tokens.emplace_back(1, c);
    }

    flush_current();
    return tokens;
}

std::string join_tokens(const std::vector<std::string>& tokens, size_t start, size_t end)
{
    if (start >= end)
    {
        return {};
    }

    std::ostringstream out;
    for (size_t i = start; i < end; ++i)
    {
        if (i > start)
        {
            out << ' ';
        }
        out << tokens[i];
    }
    return out.str();
}

std::vector<std::string> split_lines(const std::string& source)
{
    std::vector<std::string> lines;
    std::string current;

    for (char c : source)
    {
        if (c == '\n')
        {
            lines.push_back(current);
            current.clear();
        }
        else if (c != '\r')
        {
            current.push_back(c);
        }
    }
    lines.push_back(current);

    return lines;
}

bool is_type_keyword(const std::string& token)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    return cfg.primitive_type_keywords.find(token) != cfg.primitive_type_keywords.end();
}

std::string detect_statement_kind(const std::vector<std::string>& statement_tokens)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (statement_tokens.empty())
    {
        return cfg.node_statement;
    }

    const std::string& first_token = statement_tokens.front();
    if (cfg.conditional_keywords.find(first_token) != cfg.conditional_keywords.end())
    {
        return cfg.node_conditional_statement;
    }
    if (cfg.loop_keywords.find(first_token) != cfg.loop_keywords.end())
    {
        return cfg.node_loop_statement;
    }
    if (first_token == "return") return cfg.node_return_statement;
    if (first_token == "class") return cfg.node_class_decl;
    if (first_token == "struct") return cfg.node_struct_decl;
    if (first_token == "namespace") return cfg.node_namespace_decl;
    bool has_assignment = false;
    bool has_member_arrow = false;
    for (const std::string& token : statement_tokens)
    {
        if (token == cfg.token_assignment)
        {
            has_assignment = true;
        }
        if (token == cfg.token_member_arrow)
        {
            has_member_arrow = true;
        }
    }

    if (has_assignment && has_member_arrow)
    {
        return cfg.node_member_assignment;
    }

    if (has_assignment || is_type_keyword(first_token))
    {
        return cfg.node_assignment_or_decl;
    }

    return cfg.node_statement;
}

void append_node_at_path(ParseTreeNode& root, const std::vector<size_t>& path, ParseTreeNode node)
{
    ParseTreeNode* target = &root;
    for (size_t idx : path)
    {
        target = &target->children[idx];
    }
    target->children.push_back(std::move(node));
}

void register_classes_in_line(
    const std::vector<std::string>& line_tokens,
    std::unordered_map<size_t, std::vector<std::string>>& class_hash_registry)
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

        class_hash_registry[class_hash].push_back(class_name);
        on_class_scanned_structural_hook(class_name, line_tokens, g_build_context);
    }
}

bool token_hits_registered_class(
    const std::string& token,
    const std::unordered_map<size_t, std::vector<std::string>>& class_hash_registry,
    size_t& out_class_hash,
    bool& out_collision)
{
    out_class_hash = std::hash<std::string>{}(token);
    const auto hit = class_hash_registry.find(out_class_hash);
    if (hit == class_hash_registry.end())
    {
        return false;
    }

    bool exact_name_match = false;
    for (const std::string& name : hit->second)
    {
        if (name == token)
        {
            exact_name_match = true;
            break;
        }
    }

    out_collision = !exact_name_match || hit->second.size() > 1;
    return exact_name_match;
}

void collect_line_hash_trace(
    size_t line_number,
    const std::vector<std::string>& line_tokens,
    size_t hit_token_index,
    size_t class_hash,
    bool hash_collision)
{
    if (line_tokens.empty() || hit_token_index >= line_tokens.size())
    {
        return;
    }

    std::vector<bool> dirty(line_tokens.size(), false);
    for (size_t i = 0; i < line_tokens.size(); ++i)
    {
        dirty[i] = true;
    }

    size_t current_hash = class_hash;
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
    trace.line_number = line_number;
    trace.class_name = line_tokens[hit_token_index];
    trace.class_name_hash = class_hash;
    trace.hit_token_index = hit_token_index;
    trace.outgoing_hash = current_hash;
    trace.hash_collision = hash_collision;
    trace.dirty_token_count = line_tokens.size();
    trace.hash_chain = std::move(chain);
    g_line_hash_traces.push_back(std::move(trace));
}
} // namespace

void set_parse_tree_build_context(const ParseTreeBuildContext& context)
{
    g_build_context = context;
}

const ParseTreeBuildContext& get_parse_tree_build_context()
{
    return g_build_context;
}

const std::vector<LineHashTrace>& get_line_hash_traces()
{
    return g_line_hash_traces;
}

ParseTreeNode build_cpp_parse_tree(const std::string& source)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    ParseTreeNode root{cfg.node_translation_unit, "", {}};
    const std::vector<std::string> lines = split_lines(source);
    g_line_hash_traces.clear();

    std::vector<size_t> context_path;
    std::vector<std::string> statement_tokens;
    std::unordered_map<size_t, std::vector<std::string>> class_hash_registry;

    auto flush_statement = [&]() {
        if (statement_tokens.empty())
        {
            return;
        }

        ParseTreeNode node;
        node.kind = detect_statement_kind(statement_tokens);
        node.value = join_tokens(statement_tokens, 0, statement_tokens.size());
        append_node_at_path(root, context_path, std::move(node));
        statement_tokens.clear();
    };

    for (size_t line_idx = 0; line_idx < lines.size(); ++line_idx)
    {
        const std::vector<std::string> line_tokens = tokenize_text(lines[line_idx]);
        register_classes_in_line(line_tokens, class_hash_registry);

        for (size_t token_idx = 0; token_idx < line_tokens.size(); ++token_idx)
        {
            size_t class_hash = 0;
            bool hash_collision = false;
            if (token_hits_registered_class(line_tokens[token_idx], class_hash_registry, class_hash, hash_collision))
            {
                collect_line_hash_trace(line_idx + 1, line_tokens, token_idx, class_hash, hash_collision);
            }
        }

        for (const std::string& token : line_tokens)
        {
            if (token == cfg.token_open_brace)
            {
                ParseTreeNode block;
                block.kind = cfg.node_block;
                block.value = join_tokens(statement_tokens, 0, statement_tokens.size());

                ParseTreeNode* target = &root;
                for (size_t idx : context_path)
                {
                    target = &target->children[idx];
                }

                target->children.push_back(std::move(block));
                const size_t new_index = target->children.size() - 1;
                context_path.push_back(new_index);
                statement_tokens.clear();
                continue;
            }

            if (token == cfg.token_close_brace)
            {
                flush_statement();
                if (!context_path.empty())
                {
                    context_path.pop_back();
                }
                continue;
            }

            if (token == cfg.token_statement_end)
            {
                flush_statement();
                continue;
            }

            statement_tokens.push_back(token);
        }
    }

    flush_statement();

    // Precompute symbol tables for downstream design-pattern modules.
    rebuild_parse_tree_symbol_tables(root);

    return root;
}

std::string parse_tree_to_text(const ParseTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const ParseTreeNode&, int)> walk = [&](const ParseTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;
        if (!node.value.empty())
        {
            out << ": " << node.value;
        }
        out << '\n';

        for (const ParseTreeNode& child : node.children)
        {
            walk(child, depth + 1);
        }
    };

    walk(root, 0);
    return out.str();
}

std::string parse_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(root, "C++ Parse Tree");
}
