#include "parse_tree.hpp"
#include "parse_tree_symbols.hpp"
#include "language_tokens.hpp"
#include "tree_html_renderer.hpp"

#include <cctype>
#include <functional>
#include <sstream>
#include <string>
#include <vector>

namespace
{
std::vector<std::string> tokenize_cpp(const std::string& source)
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
} // namespace

ParseTreeNode build_cpp_parse_tree(const std::string& source)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    ParseTreeNode root{cfg.node_translation_unit, "", {}};
    const std::vector<std::string> tokens = tokenize_cpp(source);

    std::vector<size_t> context_path;
    std::vector<std::string> statement_tokens;

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

    for (const std::string& token : tokens)
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
