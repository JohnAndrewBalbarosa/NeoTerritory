#include "Internal/parse_tree_internal.hpp"

#include "Language-and-Structure/language_tokens.hpp"
#include "Language-and-Structure/lexical_structure_hooks.hpp"

#include <cctype>
#include <regex>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace parse_tree_internal
{
namespace
{
void clear_statement_buffers(
    std::vector<std::string>& statement_tokens,
    std::vector<std::string>& tracked_statement_tokens,
    std::vector<size_t>& statement_usage_hashes)
{
    statement_tokens.clear();
    tracked_statement_tokens.clear();
    statement_usage_hashes.clear();
}

std::string trim_ascii(const std::string& input)
{
    size_t begin = 0;
    while (begin < input.size() && std::isspace(static_cast<unsigned char>(input[begin])))
    {
        ++begin;
    }

    size_t end = input.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }

    return input.substr(begin, end - begin);
}

bool has_factory_keyword(const std::string& token)
{
    return lowercase_ascii(token).find("factory") != std::string::npos;
}

bool token_is_registered_class(
    const std::string& token,
    const ClassHashRegistry& class_hash_registry)
{
    const size_t class_hash = std::hash<std::string>{}(token);
    const auto bucket_hit = class_hash_registry.find(class_hash);
    if (bucket_hit == class_hash_registry.end())
    {
        return false;
    }

    for (const RegisteredClassSymbol& symbol : bucket_hit->second)
    {
        if (symbol.class_name == token)
        {
            return true;
        }
    }
    return false;
}

void track_factory_instance_declaration(
    const std::string& line,
    const ClassHashRegistry& class_hash_registry,
    std::unordered_map<std::string, std::string>& out_instance_type_by_name)
{
    const std::regex declaration_regex(
        R"(^\s*(?:static\s+)?(?:const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\*|&)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:[=({][^;]*)?;\s*$)");

    std::smatch match;
    if (!std::regex_match(line, match, declaration_regex))
    {
        return;
    }

    const std::string type_name = match[1].str();
    const std::string instance_name = match[2].str();
    if (!has_factory_keyword(type_name))
    {
        return;
    }
    if (!token_is_registered_class(type_name, class_hash_registry))
    {
        return;
    }
    if (instance_name.empty())
    {
        return;
    }

    out_instance_type_by_name[instance_name] = type_name;
}

bool parse_factory_callsite_from_line(
    const std::string& line,
    std::string& out_invocation_form,
    std::string& out_receiver_token,
    std::string& out_argument_token)
{
    const std::regex static_declaration_regex(
        R"(^\s*[^;=]+\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*::\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex static_assignment_regex(
        R"(^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*::\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_dot_declaration_regex(
        R"(^\s*[^;=]+\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_dot_assignment_regex(
        R"(^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_arrow_declaration_regex(
        R"(^\s*[^;=]+\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*->\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_arrow_assignment_regex(
        R"(^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*->\s*create\s*\(([^;]*)\)\s*;\s*$)");

    std::smatch match;
    if (std::regex_match(line, match, static_declaration_regex) ||
        std::regex_match(line, match, static_assignment_regex))
    {
        out_invocation_form = "static_class";
        out_receiver_token = match[1].str();
        out_argument_token = trim_ascii(match[2].str());
        return true;
    }

    if (std::regex_match(line, match, instance_dot_declaration_regex) ||
        std::regex_match(line, match, instance_dot_assignment_regex))
    {
        out_invocation_form = "instance_dot";
        out_receiver_token = match[1].str();
        out_argument_token = trim_ascii(match[2].str());
        return true;
    }

    if (std::regex_match(line, match, instance_arrow_declaration_regex) ||
        std::regex_match(line, match, instance_arrow_assignment_regex))
    {
        out_invocation_form = "instance_arrow";
        out_receiver_token = match[1].str();
        out_argument_token = trim_ascii(match[2].str());
        return true;
    }

    return false;
}

void collect_factory_invocation_trace_for_line(
    const std::string& file_path,
    size_t line_number,
    const std::string& line,
    size_t scope_context_hash,
    const ClassHashRegistry& class_hash_registry,
    const std::unordered_map<std::string, std::string>& instance_type_by_name,
    std::vector<FactoryInvocationTrace>& out_traces)
{
    std::string invocation_form;
    std::string receiver_token;
    std::string argument_token;
    if (!parse_factory_callsite_from_line(
            line,
            invocation_form,
            receiver_token,
            argument_token))
    {
        return;
    }

    if (argument_token.empty())
    {
        return;
    }

    std::string resolved_factory_class;
    if (invocation_form == "static_class")
    {
        if (token_is_registered_class(receiver_token, class_hash_registry))
        {
            resolved_factory_class = receiver_token;
        }
    }
    else
    {
        const auto instance_hit = instance_type_by_name.find(receiver_token);
        if (instance_hit != instance_type_by_name.end())
        {
            resolved_factory_class = instance_hit->second;
        }
    }

    if (!has_factory_keyword(receiver_token) && !has_factory_keyword(resolved_factory_class))
    {
        return;
    }

    FactoryInvocationTrace trace;
    trace.file_path = file_path;
    trace.line_number = line_number;
    trace.invocation_form = invocation_form;
    trace.receiver_token = receiver_token;
    trace.resolved_factory_class = resolved_factory_class;
    trace.argument_token = argument_token;
    trace.argument_hash_id = make_fnv1a64_hash_id(argument_token);
    trace.scope_context_hash = scope_context_hash;
    out_traces.push_back(std::move(trace));
}
} // namespace

void parse_file_content_into_node(
    const SourceFileUnit& file,
    ParseTreeNode& file_node,
    const ParseTreeBuildContext& context,
    StructuralAnalysisState& structural_state,
    std::vector<LineHashTrace>& line_hash_traces,
    std::vector<FactoryInvocationTrace>& factory_invocation_traces,
    ClassHashRegistry& class_hash_registry)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> lines = split_lines(file.content);
    const bool track_factory_invocations = lowercase_ascii(context.source_pattern) == "factory";

    std::vector<size_t> context_path;
    std::vector<std::vector<size_t>> scope_usage_hashes(1);
    std::vector<std::string> statement_tokens;
    std::vector<std::string> tracked_statement_tokens;
    std::vector<size_t> statement_usage_hashes;
    std::unordered_map<std::string, std::string> factory_instance_type_by_name;

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

        register_classes_in_line(file.path, line_tokens, context, structural_state, class_hash_registry);

        const ParseTreeNode* current_scope_node = node_at_path(static_cast<const ParseTreeNode&>(file_node), context_path);
        const size_t current_scope_hash =
            current_scope_node != nullptr ? current_scope_node->contextual_hash : file_node.contextual_hash;

        if (track_factory_invocations)
        {
            track_factory_instance_declaration(
                lines[line_idx],
                class_hash_registry,
                factory_instance_type_by_name);
            collect_factory_invocation_trace_for_line(
                file.path,
                line_idx + 1,
                lines[line_idx],
                current_scope_hash,
                class_hash_registry,
                factory_instance_type_by_name,
                factory_invocation_traces);
        }

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
                    current_scope_hash,
                    line_hash_traces);
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
            if (is_crucial_class_name(structural_state, token, &crucial_class_hash))
            {
                const ParseTreeNode* scope_node = node_at_path(static_cast<const ParseTreeNode&>(file_node), context_path);
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
} // namespace parse_tree_internal
