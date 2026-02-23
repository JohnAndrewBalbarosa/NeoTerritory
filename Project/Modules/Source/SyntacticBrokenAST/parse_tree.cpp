#include "parse_tree.hpp"

#include "language_tokens.hpp"
#include "lexical_structure_hooks.hpp"
#include "parse_tree_symbols.hpp"
#include "tree_html_renderer.hpp"

#include <cctype>
#include <functional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace
{
ParseTreeBuildContext g_build_context;
std::vector<LineHashTrace> g_line_hash_traces;

struct RegisteredClassSymbol
{
    std::string class_name;
    std::string file_path;
    size_t class_name_hash = 0;
    size_t contextual_hash = 0;
};

using ClassHashRegistry = std::unordered_map<size_t, std::vector<RegisteredClassSymbol>>;

const char* const k_file_class_bucket_kind = "ClassDeclarations";
const char* const k_file_global_function_bucket_kind = "GlobalFunctionDeclarations";

size_t hash_combine_token(size_t seed, const std::string& token)
{
    return std::hash<std::string>{}(std::to_string(seed) + "|" + token);
}

size_t derive_child_context_hash(
    size_t parent_hash,
    const std::string& kind,
    const std::string& value,
    size_t sibling_index)
{
    return std::hash<std::string>{}(
        std::to_string(parent_hash) +
        "|" + kind +
        "|" + value +
        "|" + std::to_string(sibling_index));
}

size_t hash_class_name_with_file(const std::string& file_path, const std::string& class_name)
{
    return std::hash<std::string>{}(file_path + "|" + class_name);
}

void rehash_subtree(ParseTreeNode& node, size_t parent_hash, size_t sibling_index)
{
    node.contextual_hash = derive_child_context_hash(parent_hash, node.kind, node.value, sibling_index);
    for (size_t i = 0; i < node.children.size(); ++i)
    {
        rehash_subtree(node.children[i], node.contextual_hash, i);
    }
}

void add_unique_hash(std::vector<size_t>& hashes, size_t hash_value)
{
    for (size_t existing : hashes)
    {
        if (existing == hash_value)
        {
            return;
        }
    }
    hashes.push_back(hash_value);
}

std::string usage_hash_suffix(const std::vector<size_t>& active_usage_hashes)
{
    if (active_usage_hashes.empty())
    {
        return {};
    }

    std::ostringstream out;
    out << "@[";
    for (size_t i = 0; i < active_usage_hashes.size(); ++i)
    {
        if (i > 0)
        {
            out << ",";
        }
        out << active_usage_hashes[i];
    }
    out << "]";
    return out.str();
}

std::string usage_hash_list(const std::vector<size_t>& usage_hashes)
{
    if (usage_hashes.empty())
    {
        return {};
    }

    std::ostringstream out;
    for (size_t i = 0; i < usage_hashes.size(); ++i)
    {
        if (i > 0)
        {
            out << ",";
        }
        out << usage_hashes[i];
    }
    return out.str();
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

ParseTreeNode* node_at_path(ParseTreeNode& root, const std::vector<size_t>& path)
{
    ParseTreeNode* target = &root;
    for (size_t idx : path)
    {
        if (idx >= target->children.size())
        {
            return nullptr;
        }
        target = &target->children[idx];
    }
    return target;
}

size_t append_node_at_path(ParseTreeNode& root, const std::vector<size_t>& path, ParseTreeNode node)
{
    ParseTreeNode* target = node_at_path(root, path);
    if (target == nullptr)
    {
        return 0;
    }

    const size_t sibling_index = target->children.size();
    node.contextual_hash = derive_child_context_hash(target->contextual_hash, node.kind, node.value, sibling_index);
    target->children.push_back(std::move(node));
    return sibling_index;
}

void register_classes_in_line(
    const std::string& file_path,
    const std::vector<std::string>& line_tokens,
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
        on_class_scanned_structural_hook(class_name, line_tokens, g_build_context);
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
    size_t scope_hash)
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
    g_line_hash_traces.push_back(std::move(trace));
}

std::string file_basename(const std::string& path)
{
    const size_t slash = path.find_last_of("/\\");
    if (slash == std::string::npos)
    {
        return path;
    }
    return path.substr(slash + 1);
}

std::string include_target_from_line(const std::string& line)
{
    const std::vector<std::string> t = tokenize_text(line);
    if (t.size() < 3 || t[0] != "#" || lowercase_ascii(t[1]) != "include")
    {
        return {};
    }

    if (t[2] == "<")
    {
        std::string out;
        for (size_t i = 3; i < t.size() && t[i] != ">"; ++i)
        {
            out += t[i];
        }
        return out;
    }

    if (t[2] == "\"")
    {
        std::string out;
        for (size_t i = 3; i < t.size() && t[i] != "\""; ++i)
        {
            out += t[i];
        }
        return out;
    }

    return t[2];
}

bool is_class_or_struct_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = tokenize_text(signature);
    if (words.size() < 2)
    {
        return false;
    }

    return cfg.class_keywords.find(lowercase_ascii(words.front())) != cfg.class_keywords.end();
}

bool is_function_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = tokenize_text(signature);
    if (words.empty())
    {
        return false;
    }

    bool has_open_paren = false;
    bool has_close_paren = false;
    for (const std::string& token : words)
    {
        if (token == "(")
        {
            has_open_paren = true;
        }
        else if (token == ")")
        {
            has_close_paren = true;
        }
    }

    if (!has_open_paren || !has_close_paren)
    {
        return false;
    }

    const std::string first = lowercase_ascii(words.front());
    if (cfg.function_exclusion_keywords.find(first) != cfg.function_exclusion_keywords.end())
    {
        return false;
    }

    if (is_class_or_struct_signature(signature))
    {
        return false;
    }

    return true;
}

bool is_class_declaration_node(const ParseTreeNode& node)
{
    if (node.kind == "ClassDecl" || node.kind == "StructDecl")
    {
        return true;
    }

    return node.kind == "Block" && is_class_or_struct_signature(node.value);
}

bool is_global_function_declaration_node(const ParseTreeNode& node)
{
    return node.kind == "Block" && is_function_signature(node.value);
}

void bucketize_file_node_for_traversal(ParseTreeNode& file_node)
{
    std::vector<ParseTreeNode> classes;
    std::vector<ParseTreeNode> global_functions;
    std::vector<ParseTreeNode> passthrough;
    classes.reserve(file_node.children.size());
    global_functions.reserve(file_node.children.size());
    passthrough.reserve(file_node.children.size());

    for (ParseTreeNode& child : file_node.children)
    {
        if (is_class_declaration_node(child))
        {
            classes.push_back(std::move(child));
        }
        else if (is_global_function_declaration_node(child))
        {
            global_functions.push_back(std::move(child));
        }
        else
        {
            passthrough.push_back(std::move(child));
        }
    }

    file_node.children.clear();
    file_node.children.reserve(
        passthrough.size() +
        (classes.empty() ? 0U : 1U) +
        (global_functions.empty() ? 0U : 1U));

    for (ParseTreeNode& child : passthrough)
    {
        file_node.children.push_back(std::move(child));
    }

    if (!classes.empty())
    {
        ParseTreeNode class_bucket;
        class_bucket.kind = k_file_class_bucket_kind;
        class_bucket.value = "class/struct declarations";
        class_bucket.children = std::move(classes);
        file_node.children.push_back(std::move(class_bucket));
    }

    if (!global_functions.empty())
    {
        ParseTreeNode fn_bucket;
        fn_bucket.kind = k_file_global_function_bucket_kind;
        fn_bucket.value = "global function declarations";
        fn_bucket.children = std::move(global_functions);
        file_node.children.push_back(std::move(fn_bucket));
    }

    for (size_t i = 0; i < file_node.children.size(); ++i)
    {
        rehash_subtree(file_node.children[i], file_node.contextual_hash, i);
    }
}

bool line_contains_any_tracked_token(
    const std::string& line_value,
    const std::unordered_set<std::string>& tracked_class_names,
    const std::unordered_set<std::string>& tracked_function_names)
{
    const std::vector<std::string> words = tokenize_text(line_value);
    for (const std::string& token : words)
    {
        if (tracked_class_names.find(token) != tracked_class_names.end())
        {
            return true;
        }
        if (tracked_function_names.find(token) != tracked_function_names.end())
        {
            return true;
        }
    }
    return false;
}

void clear_statement_buffers(
    std::vector<std::string>& statement_tokens,
    std::vector<std::string>& tracked_statement_tokens,
    std::vector<size_t>& statement_usage_hashes)
{
    statement_tokens.clear();
    tracked_statement_tokens.clear();
    statement_usage_hashes.clear();
}

void parse_file_content_into_node(
    const SourceFileUnit& file,
    ParseTreeNode& file_node,
    ClassHashRegistry& class_hash_registry)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> lines = split_lines(file.content);

    std::vector<size_t> context_path;
    std::vector<std::vector<size_t>> scope_usage_hashes(1);
    std::vector<std::string> statement_tokens;
    std::vector<std::string> tracked_statement_tokens;
    std::vector<size_t> statement_usage_hashes;

    auto flush_statement = [&]() {
        if (statement_tokens.empty())
        {
            return;
        }

        ParseTreeNode node;
        node.kind = detect_statement_kind(statement_tokens);
        node.value = join_tokens(statement_tokens, 0, statement_tokens.size());
        node.propagated_usage_hashes = statement_usage_hashes;

        const std::string annotated = join_tokens(tracked_statement_tokens, 0, tracked_statement_tokens.size());
        if (annotated != node.value)
        {
            node.annotated_value = annotated;
        }

        append_node_at_path(file_node, context_path, std::move(node));
        clear_statement_buffers(statement_tokens, tracked_statement_tokens, statement_usage_hashes);
    };

    auto mark_statement_with_scope_hashes = [&]() {
        for (size_t usage_hash : scope_usage_hashes.back())
        {
            add_unique_hash(statement_usage_hashes, usage_hash);
        }
    };

    for (size_t line_idx = 0; line_idx < lines.size(); ++line_idx)
    {
        const std::vector<std::string> line_tokens = tokenize_text(lines[line_idx]);

        const std::string include_target = include_target_from_line(lines[line_idx]);
        if (!include_target.empty())
        {
            ParseTreeNode include_node;
            include_node.kind = "IncludeDependency";
            include_node.value = include_target;
            append_node_at_path(file_node, {}, std::move(include_node));
        }

        register_classes_in_line(file.path, line_tokens, class_hash_registry);

        const ParseTreeNode* current_scope_node = node_at_path(file_node, context_path);
        const size_t current_scope_hash =
            current_scope_node != nullptr ? current_scope_node->contextual_hash : file_node.contextual_hash;

        for (size_t token_idx = 0; token_idx < line_tokens.size(); ++token_idx)
        {
            size_t class_hash = 0;
            bool hash_collision = false;
            size_t matched_class_context_hash = 0;
            if (token_hits_registered_class(
                    line_tokens[token_idx],
                    class_hash_registry,
                    class_hash,
                    hash_collision,
                    &matched_class_context_hash))
            {
                collect_line_hash_trace(
                    file.path,
                    line_idx + 1,
                    line_tokens,
                    token_idx,
                    class_hash,
                    matched_class_context_hash,
                    hash_collision,
                    current_scope_hash);
            }
        }

        for (const std::string& token : line_tokens)
        {
            if (token == cfg.token_open_brace)
            {
                ParseTreeNode block;
                block.kind = cfg.node_block;
                block.value = join_tokens(statement_tokens, 0, statement_tokens.size());
                block.propagated_usage_hashes = statement_usage_hashes;

                const std::string annotated = join_tokens(tracked_statement_tokens, 0, tracked_statement_tokens.size());
                if (annotated != block.value)
                {
                    block.annotated_value = annotated;
                }

                const size_t new_index = append_node_at_path(file_node, context_path, std::move(block));
                context_path.push_back(new_index);
                scope_usage_hashes.push_back(scope_usage_hashes.back());
                clear_statement_buffers(statement_tokens, tracked_statement_tokens, statement_usage_hashes);
                continue;
            }

            if (token == cfg.token_close_brace)
            {
                flush_statement();
                if (!context_path.empty())
                {
                    context_path.pop_back();
                }
                if (scope_usage_hashes.size() > 1)
                {
                    scope_usage_hashes.pop_back();
                }
                continue;
            }

            if (token == cfg.token_statement_end)
            {
                flush_statement();
                continue;
            }

            std::string tracked_token = token;
            const std::string suffix = usage_hash_suffix(scope_usage_hashes.back());
            if (!suffix.empty())
            {
                tracked_token += suffix;
            }

            statement_tokens.push_back(token);
            tracked_statement_tokens.push_back(std::move(tracked_token));
            mark_statement_with_scope_hashes();

            size_t crucial_class_hash = 0;
            if (is_crucial_class_name(token, &crucial_class_hash))
            {
                ParseTreeNode* scope_node = node_at_path(file_node, context_path);
                const size_t scope_hash =
                    scope_node != nullptr ? scope_node->contextual_hash : file_node.contextual_hash;
                const size_t scoped_usage_hash = hash_combine_token(scope_hash, std::to_string(crucial_class_hash));
                add_unique_hash(scope_usage_hashes.back(), scoped_usage_hash);
                add_unique_hash(statement_usage_hashes, scoped_usage_hash);
            }
        }
    }

    flush_statement();
}

void collect_class_definitions_by_file(
    const ParseTreeNode& node,
    const std::string& current_file,
    std::unordered_map<std::string, std::string>& class_def_file)
{
    if (node.kind == "Block")
    {
        const std::vector<std::string> words = tokenize_text(node.value);
        if (words.size() >= 2)
        {
            const std::string kw = lowercase_ascii(words[0]);
            if (kw == "class" || kw == "struct")
            {
                class_def_file[words[1]] = current_file;
            }
        }
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_class_definitions_by_file(child, current_file, class_def_file);
    }
}

void collect_symbol_dependencies_for_file(
    const ParseTreeNode& node,
    const std::string& current_file,
    const std::unordered_map<std::string, std::string>& class_def_file,
    std::unordered_set<std::string>& emitted,
    std::vector<ParseTreeNode>& out_dependencies)
{
    const std::string& searchable_value = node.value;
    if (!searchable_value.empty())
    {
        const std::vector<std::string> words = tokenize_text(searchable_value);
        for (const std::string& word : words)
        {
            const auto it = class_def_file.find(word);
            if (it == class_def_file.end() || it->second == current_file)
            {
                continue;
            }

            const std::string key = current_file + "|" + it->second + "|" + word;
            if (emitted.insert(key).second)
            {
                ParseTreeNode dep;
                dep.kind = "SymbolDependency";
                dep.value = word + " -> " + it->second;
                out_dependencies.push_back(std::move(dep));
            }
        }
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_symbol_dependencies_for_file(child, current_file, class_def_file, emitted, out_dependencies);
    }
}

void resolve_include_dependencies(
    ParseTreeNode& node,
    const std::unordered_map<std::string, std::string>& basename_to_path)
{
    if (node.kind == "IncludeDependency")
    {
        const auto it = basename_to_path.find(node.value);
        if (it != basename_to_path.end())
        {
            node.value = node.value + " -> " + it->second;
        }
    }

    for (ParseTreeNode& child : node.children)
    {
        resolve_include_dependencies(child, basename_to_path);
    }
}

bool append_shadow_subtree_if_relevant(
    const ParseTreeNode& source,
    const std::unordered_set<std::string>& tracked_class_names,
    const std::unordered_set<std::string>& tracked_function_names,
    ParseTreeNode& out_shadow_node)
{
    std::vector<ParseTreeNode> kept_children;
    kept_children.reserve(source.children.size());

    for (const ParseTreeNode& child : source.children)
    {
        ParseTreeNode shadow_child;
        if (append_shadow_subtree_if_relevant(child, tracked_class_names, tracked_function_names, shadow_child))
        {
            kept_children.push_back(std::move(shadow_child));
        }
    }

    const bool tracked_value =
        line_contains_any_tracked_token(source.value, tracked_class_names, tracked_function_names) ||
        line_contains_any_tracked_token(source.annotated_value, tracked_class_names, tracked_function_names);
    const bool self_relevant = !source.propagated_usage_hashes.empty() || tracked_value;

    if (source.kind == k_file_global_function_bucket_kind && kept_children.empty())
    {
        return false;
    }

    if (!self_relevant && kept_children.empty())
    {
        return false;
    }

    out_shadow_node.kind = source.kind;
    out_shadow_node.value = source.value;
    out_shadow_node.annotated_value = source.annotated_value;
    out_shadow_node.contextual_hash = source.contextual_hash;
    out_shadow_node.propagated_usage_hashes = source.propagated_usage_hashes;
    out_shadow_node.children = std::move(kept_children);
    return true;
}
} // namespace

void set_parse_tree_build_context(const ParseTreeBuildContext& context)
{
    g_build_context = context;
    reset_structural_analysis_state();
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
    std::vector<SourceFileUnit> single_file;
    single_file.push_back(SourceFileUnit{"<memory>", source});
    return build_cpp_parse_tree(single_file);
}

ParseTreeNode build_cpp_parse_tree(const std::vector<SourceFileUnit>& files)
{
    ParseTreeBundle bundle = build_cpp_parse_trees(files);
    return bundle.main_tree;
}

ParseTreeBundle build_cpp_parse_trees(const std::vector<SourceFileUnit>& files)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);

    ParseTreeBundle bundle;
    bundle.main_tree.kind = cfg.node_translation_unit;
    bundle.main_tree.value = "Root";
    bundle.main_tree.contextual_hash = std::hash<std::string>{}(cfg.node_translation_unit + "|Root|main");

    bundle.shadow_tree.kind = cfg.node_translation_unit;
    bundle.shadow_tree.value = "Root";
    bundle.shadow_tree.contextual_hash = bundle.main_tree.contextual_hash;

    g_line_hash_traces.clear();
    reset_structural_analysis_state();

    ClassHashRegistry class_hash_registry;
    std::unordered_map<std::string, std::string> class_def_file;
    std::unordered_map<std::string, std::string> basename_to_path;

    bundle.main_tree.children.reserve(files.size());
    bundle.shadow_tree.children.reserve(files.size());
    for (size_t i = 0; i < files.size(); ++i)
    {
        const SourceFileUnit& file = files[i];

        ParseTreeNode main_file_node;
        main_file_node.kind = "FileUnit";
        main_file_node.value = file.path;
        main_file_node.contextual_hash = derive_child_context_hash(
            bundle.main_tree.contextual_hash,
            main_file_node.kind,
            main_file_node.value,
            bundle.main_tree.children.size());
        const size_t file_context_hash = main_file_node.contextual_hash;
        bundle.main_tree.children.push_back(std::move(main_file_node));

        ParseTreeNode shadow_file_node;
        shadow_file_node.kind = "FileUnit";
        shadow_file_node.value = file.path;
        shadow_file_node.contextual_hash = file_context_hash;
        bundle.shadow_tree.children.push_back(std::move(shadow_file_node));

        basename_to_path[file_basename(file.path)] = file.path;
    }

    for (size_t i = 0; i < files.size(); ++i)
    {
        parse_file_content_into_node(files[i], bundle.main_tree.children[i], class_hash_registry);
        collect_class_definitions_by_file(bundle.main_tree.children[i], files[i].path, class_def_file);
    }

    for (ParseTreeNode& file_node : bundle.main_tree.children)
    {
        resolve_include_dependencies(file_node, basename_to_path);

        std::unordered_set<std::string> emitted;
        std::vector<ParseTreeNode> symbol_deps;
        collect_symbol_dependencies_for_file(
            file_node,
            file_node.value,
            class_def_file,
            emitted,
            symbol_deps);

        for (ParseTreeNode& dep : symbol_deps)
        {
            append_node_at_path(file_node, {}, std::move(dep));
        }

        bucketize_file_node_for_traversal(file_node);
    }

    rebuild_parse_tree_symbol_tables(bundle.main_tree);

    std::unordered_set<std::string> tracked_class_names;
    for (const CrucialClassInfo& class_info : get_crucial_class_registry())
    {
        tracked_class_names.insert(class_info.name);
    }

    std::unordered_set<std::string> tracked_function_names;
    for (const ParseSymbol& function_symbol : getFunctionSymbolTable())
    {
        if (tracked_class_names.find(function_symbol.owner_scope) != tracked_class_names.end())
        {
            tracked_function_names.insert(function_symbol.name);
        }
    }

    for (size_t i = 0; i < bundle.main_tree.children.size() && i < bundle.shadow_tree.children.size(); ++i)
    {
        ParseTreeNode& shadow_file = bundle.shadow_tree.children[i];
        shadow_file.children.clear();

        for (const ParseTreeNode& child : bundle.main_tree.children[i].children)
        {
            ParseTreeNode filtered;
            if (append_shadow_subtree_if_relevant(
                    child,
                    tracked_class_names,
                    tracked_function_names,
                    filtered))
            {
                shadow_file.children.push_back(std::move(filtered));
            }
        }

        bucketize_file_node_for_traversal(shadow_file);
    }

    return bundle;
}

std::string parse_tree_to_text(const ParseTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const ParseTreeNode&, int)> walk = [&](const ParseTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;

        const std::string& display_value = node.annotated_value.empty() ? node.value : node.annotated_value;
        if (!display_value.empty())
        {
            out << ": " << display_value;
        }

        out << " | ctx_hash=" << node.contextual_hash;
        if (!node.propagated_usage_hashes.empty())
        {
            out << " | scope_usage_hashes=" << usage_hash_list(node.propagated_usage_hashes);
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
