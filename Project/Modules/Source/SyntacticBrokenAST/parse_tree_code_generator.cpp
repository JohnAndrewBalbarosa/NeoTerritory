#include "parse_tree_code_generator.hpp"

#include "Singleton/singleton_pattern_logic.hpp"
#include "language_tokens.hpp"
#include "parse_tree.hpp"
#include "parse_tree_symbols.hpp"

#include <cctype>
#include <regex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace
{
std::vector<TransformDecision> g_last_transform_decisions;

std::string lower(const std::string& s)
{
    return lowercase_ascii(s);
}

std::string trim(const std::string& input)
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

std::vector<std::string> split_words(const std::string& text)
{
    std::vector<std::string> words;
    std::string current;

    for (char c : text)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
        }
        else if (!current.empty())
        {
            words.push_back(current);
            current.clear();
        }
    }

    if (!current.empty())
    {
        words.push_back(current);
    }

    return words;
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
}

size_t find_matching_brace(const std::string& text, size_t open_pos)
{
    if (open_pos >= text.size() || text[open_pos] != '{')
    {
        return std::string::npos;
    }

    int depth = 0;
    for (size_t i = open_pos; i < text.size(); ++i)
    {
        if (text[i] == '{')
        {
            ++depth;
        }
        else if (text[i] == '}')
        {
            --depth;
            if (depth == 0)
            {
                return i;
            }
        }
    }

    return std::string::npos;
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::vector<std::string> words = split_words(trim(node.value));
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lower(words[i]);
        if (kw == "class" || kw == "struct")
        {
            return true;
        }
    }
    return false;
}

bool is_function_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string signature = trim(node.value);
    if (signature.empty() || signature.find('(') == std::string::npos || signature.find(')') == std::string::npos)
    {
        return false;
    }

    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    if (words.empty())
    {
        return false;
    }

    const std::string first = lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

std::string class_name_from_signature(const std::string& signature)
{
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lower(words[i]);
        if (kw == "class" || kw == "struct")
        {
            return words[i + 1];
        }
    }
    return {};
}

std::string function_name_from_signature(const std::string& signature)
{
    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::vector<std::string> words = split_words(trimmed.substr(0, open));
    if (words.empty())
    {
        return {};
    }

    return words.back();
}

void inject_singleton_accessor(std::string& source, const std::string& class_name)
{
    const std::string class_kw = "class " + class_name;
    const std::string struct_kw = "struct " + class_name;

    size_t class_pos = source.find(class_kw);
    if (class_pos == std::string::npos)
    {
        class_pos = source.find(struct_kw);
    }
    if (class_pos == std::string::npos)
    {
        return;
    }

    const size_t open_brace = source.find('{', class_pos);
    if (open_brace == std::string::npos)
    {
        return;
    }
    const size_t close_brace = find_matching_brace(source, open_brace);
    if (close_brace == std::string::npos)
    {
        return;
    }

    std::string class_body = source.substr(open_brace + 1, close_brace - open_brace - 1);
    if (class_body.find("static " + class_name + "& instance(") != std::string::npos)
    {
        return;
    }

    const std::string singleton_method =
        "\n    static " + class_name + "& instance() {\n"
        "        static " + class_name + " singleton_instance;\n"
        "        return singleton_instance;\n"
        "    }\n";

    size_t public_pos = class_body.find("public:");
    if (public_pos != std::string::npos)
    {
        class_body.insert(public_pos + std::string("public:").size(), singleton_method);
    }
    else
    {
        class_body = "\npublic:" + singleton_method + class_body;
    }

    source.replace(open_brace + 1, close_brace - open_brace - 1, class_body);
}

void rewrite_class_instantiations_to_singleton_references(std::string& source, const std::string& class_name)
{
    const std::regex pointer_decl(
        "\\b" + class_name + R"(\s*\*\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*new\s+)" + class_name + R"(\s*\([^;{}]*\)\s*;)");
    source = std::regex_replace(source, pointer_decl, "auto& $1 = " + class_name + "::instance();");

    const std::regex simple_decl("\\b" + class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
    source = std::regex_replace(source, simple_decl, "auto& $1 = " + class_name + "::instance();");

    const std::regex ctor_decl("\\b" + class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*;)");
    source = std::regex_replace(source, ctor_decl, "auto& $1 = " + class_name + "::instance();");

    // Undo accidental rewrite inside injected singleton accessor.
    const std::regex bad_singleton_line(
        R"(static\s+auto&\s+singleton_instance\s*=\s*)" + class_name + R"(\s*::\s*instance\s*\(\s*\)\s*;)");
    source = std::regex_replace(source, bad_singleton_line, "static " + class_name + " singleton_instance;");
}

std::vector<std::string> extract_crucial_class_names(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    ParseTreeBuildContext context;
    context.source_pattern = source_pattern;
    context.target_pattern = target_pattern;

    std::vector<SourceFileUnit> files;
    files.push_back(SourceFileUnit{"<memory>", source});

    const ParseTreeBundle bundle = build_cpp_parse_trees(files, context);

    std::vector<std::string> names;
    std::unordered_set<std::string> seen;
    for (const CrucialClassInfo& info : bundle.crucial_classes)
    {
        if (info.name.empty())
        {
            continue;
        }
        if (seen.insert(info.name).second)
        {
            names.push_back(info.name);
        }
    }

    return names;
}

TransformDecision& ensure_decision(
    std::unordered_map<std::string, TransformDecision>& decisions_by_class,
    const std::string& class_name)
{
    auto it = decisions_by_class.find(class_name);
    if (it != decisions_by_class.end())
    {
        return it->second;
    }

    TransformDecision decision;
    decision.class_name = class_name;
    auto inserted = decisions_by_class.insert({class_name, std::move(decision)});
    return inserted.first->second;
}

void add_reason_if_missing(TransformDecision& decision, const std::string& reason)
{
    for (const std::string& existing : decision.transform_reason)
    {
        if (existing == reason)
        {
            return;
        }
    }
    decision.transform_reason.push_back(reason);
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

std::string join_lines(const std::vector<std::string>& lines)
{
    std::ostringstream out;
    for (size_t i = 0; i < lines.size(); ++i)
    {
        if (i > 0)
        {
            out << '\n';
        }
        out << lines[i];
    }
    return out.str();
}

std::unordered_map<std::string, std::string> collect_singleton_strength_by_class(const CreationalTreeNode& singleton_tree)
{
    std::unordered_map<std::string, std::string> out;
    for (const CreationalTreeNode& class_node : singleton_tree.children)
    {
        if (class_node.kind != "ClassNode" || class_node.label.empty())
        {
            continue;
        }

        std::string strength;
        for (const CreationalTreeNode& fn_node : class_node.children)
        {
            if (fn_node.kind != "SingletonFunction")
            {
                continue;
            }

            for (const CreationalTreeNode& detail : fn_node.children)
            {
                if (detail.kind != "SingletonStrength")
                {
                    continue;
                }

                if (detail.label == "strong")
                {
                    strength = "strong";
                    break;
                }
                if (strength.empty() && detail.label == "weak")
                {
                    strength = "weak";
                }
            }

            if (strength == "strong")
            {
                break;
            }
        }

        if (!strength.empty())
        {
            out[class_node.label] = strength;
        }
    }

    return out;
}

bool is_config_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return starts_with(lowered, "set") ||
           starts_with(lowered, "with") ||
           starts_with(lowered, "enable") ||
           starts_with(lowered, "disable") ||
           starts_with(lowered, "configure");
}

bool is_monolithic_config_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return starts_with(lowered, "set_") ||
           starts_with(lowered, "with_") ||
           starts_with(lowered, "enable_") ||
           starts_with(lowered, "configure_");
}

bool is_monolithic_build_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult";
}

bool is_build_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult";
}

bool is_operational_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return !is_config_method_name(method_name) &&
           !is_build_method_name(method_name) &&
           lowered != "instance";
}

bool ends_with(const std::string& text, const std::string& suffix)
{
    return text.size() >= suffix.size() &&
           text.compare(text.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::string strip_builder_suffix(const std::string& class_name)
{
    if (!ends_with(class_name, "Builder"))
    {
        return class_name;
    }
    return class_name.substr(0, class_name.size() - std::string("Builder").size());
}

void append_unique_token(std::vector<std::string>& out, const std::string& token)
{
    if (token.empty())
    {
        return;
    }
    for (const std::string& existing : out)
    {
        if (existing == token)
        {
            return;
        }
    }
    out.push_back(token);
}

void append_unique_line(std::vector<std::string>& out, const std::string& line)
{
    const std::string normalized = trim(line);
    if (normalized.empty())
    {
        return;
    }
    append_unique_token(out, normalized);
}

void append_unique_lines(std::vector<std::string>& out, const std::vector<std::string>& lines)
{
    for (const std::string& line : lines)
    {
        append_unique_line(out, line);
    }
}

std::string regex_capture_or_empty(const std::smatch& match, size_t index)
{
    if (index >= match.size())
    {
        return {};
    }
    return match[index].str();
}

struct SingletonCallsiteEvidence
{
    std::string class_name;
    std::string variable_name;
    std::vector<std::string> config_chain;
    std::vector<std::string> operational_methods;
};

struct EvidenceScanResult
{
    std::vector<std::string> lines;
    std::vector<std::string> singleton_markers;
    std::vector<std::string> builder_markers;
    std::vector<std::string> callsite_before_markers;
    std::vector<std::string> callsite_after_markers;
    std::vector<std::string> operational_markers;
    std::vector<std::string> singleton_class_names;
    std::vector<std::string> builder_class_names;
    std::vector<std::string> relevant_class_names;
    std::vector<std::string> operational_method_names;
    std::vector<SingletonCallsiteEvidence> singleton_callsites;
    std::vector<SingletonCallsiteEvidence> target_builder_callsites;
};

std::vector<std::string> collect_class_signature_lines(
    const std::vector<std::string>& lines,
    const std::vector<std::string>& class_names)
{
    std::unordered_set<std::string> wanted(class_names.begin(), class_names.end());
    if (wanted.empty())
    {
        return {};
    }

    const std::regex class_decl_regex(R"(\b(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b)");
    std::vector<std::string> out;

    for (const std::string& line : lines)
    {
        const std::string trimmed_line = trim(line);
        std::smatch match;
        if (std::regex_search(trimmed_line, match, class_decl_regex))
        {
            const std::string class_name = regex_capture_or_empty(match, 2);
            if (wanted.find(class_name) != wanted.end())
            {
                append_unique_line(out, trimmed_line);
            }
        }
    }

    return out;
}

std::vector<std::string> collect_method_signature_lines(
    const std::vector<std::string>& lines,
    const std::vector<std::string>& method_names)
{
    std::vector<std::string> out;
    if (method_names.empty())
    {
        return out;
    }

    for (const std::string& line : lines)
    {
        const std::string trimmed_line = trim(line);
        if (trimmed_line.empty())
        {
            continue;
        }

        for (const std::string& method_name : method_names)
        {
            const std::string method_token = method_name + "(";
            if (trimmed_line.find(method_token) == std::string::npos)
            {
                continue;
            }
            if (trimmed_line.find("." + method_token) != std::string::npos ||
                trimmed_line.find("->" + method_token) != std::string::npos)
            {
                continue;
            }

            append_unique_line(out, trimmed_line);
            break;
        }
    }

    return out;
}

int brace_delta(const std::string& line)
{
    int delta = 0;
    for (char c : line)
    {
        if (c == '{')
        {
            ++delta;
        }
        else if (c == '}')
        {
            --delta;
        }
    }
    return delta;
}

EvidenceScanResult scan_pattern_evidence(const std::string& source)
{
    EvidenceScanResult out;
    out.lines = split_lines(source);

    const std::regex singleton_accessor_regex(
        R"(\bstatic\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:&|\*)?\s+instance\s*\()");
    const std::regex singleton_call_regex(
        R"(\b([A-Za-z_][A-Za-z0-9_]*)\s*::\s*instance\s*\()");
    const std::regex builder_class_regex(
        R"(\b(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*Builder)\b)");
    const std::regex builder_step_regex(
        R"(\b([A-Za-z_][A-Za-z0-9_]*Builder)\s*&?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\()");
    const std::regex build_method_regex(
        R"(\b([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\()");
    const std::regex before_callsite_regex(
        R"(^\s*(?:const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:[&*]\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*::\s*instance\s*\(\s*\)\s*;\s*$)");
    const std::regex after_callsite_regex(
        R"(^\s*(?:const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:[&*]\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*Builder)\s*\(\s*\)(.*)\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*;\s*$)");
    const std::regex member_call_regex(
        R"(^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;\s*$)");
    const std::regex config_chain_regex(
        R"(\.\s*(set_|with_|enable_|configure_)[A-Za-z0-9_]*\s*\()");

    for (size_t i = 0; i < out.lines.size(); ++i)
    {
        const std::string& line = out.lines[i];
        const std::string trimmed_line = trim(line);
        if (trimmed_line.empty())
        {
            continue;
        }

        std::smatch match;
        if (std::regex_search(trimmed_line, match, singleton_accessor_regex))
        {
            append_unique_line(out.singleton_markers, trimmed_line);
            const std::string class_name = regex_capture_or_empty(match, 1);
            append_unique_token(out.singleton_class_names, class_name);
            append_unique_token(out.relevant_class_names, class_name);

            if (!class_name.empty())
            {
                const std::regex static_decl_for_class(
                    "\\bstatic\\s+" + class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
                const std::regex return_identifier_regex(
                    R"(\breturn\s+[&*]?\s*([A-Za-z_][A-Za-z0-9_]*)\s*;)");

                int depth = brace_delta(out.lines[i]);
                bool saw_open_brace = out.lines[i].find('{') != std::string::npos;
                std::unordered_set<std::string> static_identifiers;

                for (size_t j = i + 1; j < out.lines.size(); ++j)
                {
                    const std::string accessor_line = trim(out.lines[j]);
                    if (!accessor_line.empty())
                    {
                        std::smatch static_match;
                        if (std::regex_search(accessor_line, static_match, static_decl_for_class))
                        {
                            append_unique_line(out.singleton_markers, accessor_line);
                            static_identifiers.insert(regex_capture_or_empty(static_match, 1));
                        }

                        std::smatch return_match;
                        if (std::regex_search(accessor_line, return_match, return_identifier_regex))
                        {
                            const std::string returned_identifier = regex_capture_or_empty(return_match, 1);
                            if (static_identifiers.find(returned_identifier) != static_identifiers.end())
                            {
                                append_unique_line(out.singleton_markers, accessor_line);
                            }
                        }
                    }

                    const int line_delta = brace_delta(out.lines[j]);
                    if (line_delta > 0)
                    {
                        saw_open_brace = true;
                    }
                    depth += line_delta;
                    if (saw_open_brace && depth <= 0)
                    {
                        break;
                    }
                }
            }
        }
        if (std::regex_search(trimmed_line, match, singleton_call_regex))
        {
            append_unique_line(out.singleton_markers, trimmed_line);
            const std::string class_name = regex_capture_or_empty(match, 1);
            append_unique_token(out.singleton_class_names, class_name);
            append_unique_token(out.relevant_class_names, class_name);
        }

        if (std::regex_search(trimmed_line, match, builder_class_regex))
        {
            const std::string builder_class = regex_capture_or_empty(match, 2);
            append_unique_line(out.builder_markers, trimmed_line);
            append_unique_token(out.builder_class_names, builder_class);
            append_unique_token(out.relevant_class_names, builder_class);
            append_unique_token(out.relevant_class_names, strip_builder_suffix(builder_class));
        }
        if (std::regex_search(trimmed_line, match, builder_step_regex))
        {
            const std::string builder_class = regex_capture_or_empty(match, 1);
            const std::string method_name = regex_capture_or_empty(match, 2);
            if (is_monolithic_config_method_name(method_name))
            {
                append_unique_line(out.builder_markers, trimmed_line);
                append_unique_token(out.builder_class_names, builder_class);
                append_unique_token(out.relevant_class_names, builder_class);
                append_unique_token(out.relevant_class_names, strip_builder_suffix(builder_class));
            }
        }
        if (std::regex_search(trimmed_line, match, build_method_regex))
        {
            const std::string return_type = regex_capture_or_empty(match, 1);
            const std::string method_name = regex_capture_or_empty(match, 2);
            if (is_build_method_name(method_name))
            {
                append_unique_line(out.builder_markers, trimmed_line);
                append_unique_token(out.relevant_class_names, return_type);
            }
        }
    }

    for (size_t i = 0; i < out.lines.size(); ++i)
    {
        const std::string current_line = trim(out.lines[i]);
        std::smatch match;

        if (std::regex_match(current_line, match, before_callsite_regex))
        {
            const std::string lhs_class = regex_capture_or_empty(match, 1);
            const std::string var_name = regex_capture_or_empty(match, 2);
            const std::string rhs_class = regex_capture_or_empty(match, 3);
            if (!lhs_class.empty() && lhs_class == rhs_class)
            {
                SingletonCallsiteEvidence callsite;
                callsite.class_name = lhs_class;
                callsite.variable_name = var_name;

                append_unique_line(out.callsite_before_markers, current_line);
                append_unique_line(out.singleton_markers, current_line);
                append_unique_token(out.singleton_class_names, lhs_class);
                append_unique_token(out.relevant_class_names, lhs_class);
                append_unique_token(out.relevant_class_names, lhs_class + "Builder");

                size_t j = i + 1;
                while (j < out.lines.size())
                {
                    const std::string next_line = trim(out.lines[j]);
                    std::smatch call_match;
                    if (!std::regex_match(next_line, call_match, member_call_regex))
                    {
                        break;
                    }

                    if (regex_capture_or_empty(call_match, 1) != var_name)
                    {
                        break;
                    }

                    const std::string method_name = regex_capture_or_empty(call_match, 2);
                    const std::string method_args = trim(regex_capture_or_empty(call_match, 3));
                    if (is_monolithic_config_method_name(method_name))
                    {
                        append_unique_line(out.callsite_before_markers, next_line);
                        callsite.config_chain.push_back("." + method_name + "(" + method_args + ")");
                    }
                    else if (is_operational_method_name(method_name))
                    {
                        append_unique_line(out.operational_markers, next_line);
                        append_unique_token(out.operational_method_names, method_name);
                        append_unique_token(callsite.operational_methods, method_name);
                    }
                    ++j;
                }

                out.singleton_callsites.push_back(std::move(callsite));
                i = (j == 0) ? i : (j - 1);
                continue;
            }
        }

        if (std::regex_match(current_line, match, after_callsite_regex))
        {
            const std::string class_name = regex_capture_or_empty(match, 1);
            const std::string var_name = regex_capture_or_empty(match, 2);
            const std::string builder_class = regex_capture_or_empty(match, 3);
            const std::string chain_part = regex_capture_or_empty(match, 4);
            const std::string terminal_method = regex_capture_or_empty(match, 5);

            if (is_build_method_name(terminal_method) &&
                std::regex_search(chain_part, config_chain_regex))
            {
                SingletonCallsiteEvidence callsite;
                callsite.class_name = class_name;
                callsite.variable_name = var_name;

                const std::regex chain_method_regex(
                    R"(\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\()");
                std::sregex_iterator it(chain_part.begin(), chain_part.end(), chain_method_regex);
                std::sregex_iterator end;
                for (; it != end; ++it)
                {
                    const std::string method_name = (*it)[1].str();
                    if (is_monolithic_config_method_name(method_name))
                    {
                        callsite.config_chain.push_back("." + method_name + "(...)");
                    }
                }

                append_unique_line(out.callsite_after_markers, current_line);
                append_unique_line(out.builder_markers, current_line);
                append_unique_token(out.builder_class_names, builder_class);
                append_unique_token(out.relevant_class_names, class_name);
                append_unique_token(out.relevant_class_names, builder_class);

                size_t j = i + 1;
                while (j < out.lines.size())
                {
                    const std::string next_line = trim(out.lines[j]);
                    std::smatch call_match;
                    if (!std::regex_match(next_line, call_match, member_call_regex))
                    {
                        break;
                    }
                    if (regex_capture_or_empty(call_match, 1) != var_name)
                    {
                        break;
                    }

                    const std::string method_name = regex_capture_or_empty(call_match, 2);
                    if (is_operational_method_name(method_name))
                    {
                        append_unique_line(out.operational_markers, next_line);
                        append_unique_token(out.operational_method_names, method_name);
                        append_unique_token(callsite.operational_methods, method_name);
                    }
                    ++j;
                }

                out.target_builder_callsites.push_back(std::move(callsite));
                i = (j == 0) ? i : (j - 1);
            }
        }
    }

    return out;
}

struct MonolithicClassView
{
    std::string class_name;
    std::string accessor_line;
    std::string static_line;
    std::string return_line;
    std::vector<std::string> config_methods;
    std::vector<std::string> operational_methods;
    std::vector<std::string> builder_setter_methods;
    std::string build_method = "build";
    std::vector<SingletonCallsiteEvidence> source_callsites;
    std::vector<SingletonCallsiteEvidence> target_callsites;
};

MonolithicClassView& ensure_class_view(
    std::vector<MonolithicClassView>& views,
    const std::string& class_name)
{
    for (MonolithicClassView& view : views)
    {
        if (view.class_name == class_name)
        {
            return view;
        }
    }

    MonolithicClassView created;
    created.class_name = class_name;
    views.push_back(std::move(created));
    return views.back();
}

std::string method_name_from_chain_call(const std::string& chain_call)
{
    if (chain_call.size() < 3 || chain_call.front() != '.')
    {
        return {};
    }

    const size_t open = chain_call.find('(');
    if (open == std::string::npos || open <= 1)
    {
        return {};
    }

    return chain_call.substr(1, open - 1);
}

std::vector<MonolithicClassView> build_class_views(
    const EvidenceScanResult& source_scan,
    const EvidenceScanResult* target_scan)
{
    std::vector<MonolithicClassView> out;
    for (const std::string& class_name : source_scan.singleton_class_names)
    {
        MonolithicClassView& view = ensure_class_view(out, class_name);
        view.accessor_line = "static " + class_name + " instance()";
    }

    const std::regex accessor_regex(
        R"(\bstatic\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:&|\*)?\s+instance\s*\()");
    const std::regex static_decl_regex(
        R"(\bstatic\s+([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
    const std::regex return_regex(
        R"(\breturn\s+[&*]?\s*([A-Za-z_][A-Za-z0-9_]*)\s*;)");
    const std::regex builder_setter_regex(
        R"(\b([A-Za-z_][A-Za-z0-9_]*Builder)\s*&?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\()");
    const std::regex builder_build_regex(
        R"(\b([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\()");

    for (const std::string& marker : source_scan.singleton_markers)
    {
        std::smatch match;
        if (std::regex_search(marker, match, accessor_regex))
        {
            const std::string class_name = regex_capture_or_empty(match, 1);
            if (class_name.empty())
            {
                continue;
            }
            MonolithicClassView& view = ensure_class_view(out, class_name);
            view.accessor_line = "static " + class_name + " instance()";
            continue;
        }

        if (std::regex_search(marker, match, static_decl_regex))
        {
            const std::string class_name = regex_capture_or_empty(match, 1);
            const std::string identifier = regex_capture_or_empty(match, 2);
            if (class_name.empty() || identifier.empty())
            {
                continue;
            }
            MonolithicClassView& view = ensure_class_view(out, class_name);
            view.static_line = "static " + class_name + " " + identifier + ";";
            continue;
        }

        if (std::regex_search(marker, match, return_regex))
        {
            const std::string identifier = regex_capture_or_empty(match, 1);
            if (identifier.empty())
            {
                continue;
            }

            for (MonolithicClassView& view : out)
            {
                const std::string expected = " " + identifier + ";";
                if (view.static_line.find(expected) != std::string::npos)
                {
                    view.return_line = "return " + identifier + ";";
                    break;
                }
            }
        }
    }

    for (const SingletonCallsiteEvidence& callsite : source_scan.singleton_callsites)
    {
        if (callsite.class_name.empty())
        {
            continue;
        }

        MonolithicClassView& view = ensure_class_view(out, callsite.class_name);
        view.source_callsites.push_back(callsite);
        for (const std::string& chain_call : callsite.config_chain)
        {
            const std::string method_name = method_name_from_chain_call(chain_call);
            if (!method_name.empty())
            {
                append_unique_token(view.config_methods, method_name);
            }
        }
        for (const std::string& method_name : callsite.operational_methods)
        {
            append_unique_token(view.operational_methods, method_name);
        }
    }

    std::unordered_set<std::string> focus_classes;
    for (const MonolithicClassView& view : out)
    {
        if (!view.class_name.empty())
        {
            focus_classes.insert(view.class_name);
        }
    }

    if (target_scan != nullptr)
    {
        for (const std::string& marker : target_scan->builder_markers)
        {
            std::smatch setter_match;
            if (std::regex_search(marker, setter_match, builder_setter_regex))
            {
                const std::string builder_class = regex_capture_or_empty(setter_match, 1);
                const std::string class_name = strip_builder_suffix(builder_class);
                const std::string method_name = regex_capture_or_empty(setter_match, 2);
                if (class_name.empty() || method_name.empty())
                {
                    continue;
                }
                if (focus_classes.find(class_name) == focus_classes.end())
                {
                    continue;
                }

                MonolithicClassView& view = ensure_class_view(out, class_name);
                if (is_monolithic_config_method_name(method_name))
                {
                    append_unique_token(view.builder_setter_methods, method_name);
                    append_unique_token(view.config_methods, method_name);
                }
                continue;
            }

            std::smatch build_match;
            if (std::regex_search(marker, build_match, builder_build_regex))
            {
                const std::string return_type = regex_capture_or_empty(build_match, 1);
                const std::string method_name = regex_capture_or_empty(build_match, 2);
                if (!is_monolithic_build_method_name(method_name))
                {
                    continue;
                }
                if (focus_classes.find(return_type) == focus_classes.end())
                {
                    continue;
                }
                MonolithicClassView& view = ensure_class_view(out, return_type);
                view.build_method = method_name;
            }
        }

        for (const SingletonCallsiteEvidence& callsite : target_scan->target_builder_callsites)
        {
            if (callsite.class_name.empty())
            {
                continue;
            }
            if (focus_classes.find(callsite.class_name) == focus_classes.end())
            {
                continue;
            }

            MonolithicClassView& view = ensure_class_view(out, callsite.class_name);
            view.target_callsites.push_back(callsite);
            for (const std::string& chain_call : callsite.config_chain)
            {
                const std::string method_name = method_name_from_chain_call(chain_call);
                if (!method_name.empty())
                {
                    append_unique_token(view.builder_setter_methods, method_name);
                    append_unique_token(view.config_methods, method_name);
                }
            }
            for (const std::string& method_name : callsite.operational_methods)
            {
                append_unique_token(view.operational_methods, method_name);
            }
        }
    }

    for (MonolithicClassView& view : out)
    {
        if (view.accessor_line.empty())
        {
            view.accessor_line = "static " + view.class_name + " instance()";
        }
        if (view.static_line.empty())
        {
            view.static_line = "static " + view.class_name + " singleton_instance;";
        }
        if (view.return_line.empty())
        {
            const std::regex static_decl_regex(
                R"(\bstatic\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
            std::smatch static_match;
            if (std::regex_search(view.static_line, static_match, static_decl_regex))
            {
                view.return_line = "return " + regex_capture_or_empty(static_match, 1) + ";";
            }
            else
            {
                view.return_line = "return singleton_instance;";
            }
        }
        if (view.builder_setter_methods.empty())
        {
            for (const std::string& method_name : view.config_methods)
            {
                append_unique_token(view.builder_setter_methods, method_name);
            }
        }
    }

    return out;
}

std::vector<std::string> build_source_evidence_present_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        auto append_preserve = [&](const std::string& line) {
            const std::string normalized = trim(line);
            if (!normalized.empty())
            {
                out.push_back(normalized);
            }
        };

        std::string return_line = view.return_line;
        if (return_line.empty())
        {
            const std::regex static_decl_regex(
                R"(\bstatic\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
            std::smatch static_match;
            if (std::regex_search(view.static_line, static_match, static_decl_regex))
            {
                return_line = "return " + regex_capture_or_empty(static_match, 1) + ";";
            }
            else
            {
                return_line = "return singleton_instance;";
            }
        }

        append_preserve(view.accessor_line);
        append_preserve(view.static_line);
        append_preserve(return_line);
        for (const SingletonCallsiteEvidence& callsite : view.source_callsites)
        {
            append_preserve(
                view.class_name + " " + callsite.variable_name + " = " +
                view.class_name + "::instance();");
        }
    }
    return out;
}

std::vector<std::string> build_target_evidence_removed_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        auto append_preserve = [&](const std::string& line) {
            const std::string normalized = trim(line);
            if (!normalized.empty())
            {
                out.push_back(normalized);
            }
        };

        std::string return_line = view.return_line;
        if (return_line.empty())
        {
            const std::regex static_decl_regex(
                R"(\bstatic\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
            std::smatch static_match;
            if (std::regex_search(view.static_line, static_match, static_decl_regex))
            {
                return_line = "return " + regex_capture_or_empty(static_match, 1) + ";";
            }
            else
            {
                return_line = "return singleton_instance;";
            }
        }

        append_preserve(view.accessor_line);
        append_preserve(view.static_line);
        append_preserve(return_line);
        append_preserve(view.class_name + "::instance()");
    }
    return out;
}

std::vector<std::string> build_target_evidence_added_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        append_unique_line(out, "class " + view.class_name + "Builder");
        for (const std::string& method_name : view.builder_setter_methods)
        {
            append_unique_line(out, view.class_name + "Builder& " + method_name + "(...)");
        }
        append_unique_line(out, view.class_name + " " + view.build_method + "()");

        const std::vector<SingletonCallsiteEvidence>& callsites =
            view.target_callsites.empty() ? view.source_callsites : view.target_callsites;
        for (const SingletonCallsiteEvidence& callsite : callsites)
        {
            std::ostringstream line;
            line << view.class_name << " " << callsite.variable_name
                 << " = " << view.class_name << "Builder()";

            bool has_chain = false;
            for (const std::string& chain_call : callsite.config_chain)
            {
                const std::string method_name = method_name_from_chain_call(chain_call);
                if (method_name.empty())
                {
                    continue;
                }
                line << "." << method_name << "(...)";
                has_chain = true;
            }
            if (!has_chain)
            {
                for (const std::string& method_name : view.builder_setter_methods)
                {
                    line << "." << method_name << "(...)";
                }
            }
            line << "." << view.build_method << "();";
            append_unique_line(out, line.str());
        }
    }
    return out;
}

std::vector<std::string> build_source_type_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        out.push_back("class " + view.class_name + " {");
        out.push_back("public:");
        out.push_back("    " + view.accessor_line + ";");
        for (const std::string& method_name : view.config_methods)
        {
            out.push_back("    void " + method_name + "(...);");
        }
        for (const std::string& method_name : view.operational_methods)
        {
            out.push_back("    void " + method_name + "(...);");
        }
        out.push_back("};");
        out.push_back("");
    }

    if (!out.empty() && out.back().empty())
    {
        out.pop_back();
    }
    return out;
}

std::vector<std::string> build_target_type_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        out.push_back("class " + view.class_name + " {");
        out.push_back("public:");
        for (const std::string& method_name : view.operational_methods)
        {
            out.push_back("    void " + method_name + "(...);");
        }
        out.push_back("};");
        out.push_back("");

        out.push_back("class " + view.class_name + "Builder {");
        out.push_back("public:");
        for (const std::string& method_name : view.builder_setter_methods)
        {
            out.push_back("    " + view.class_name + "Builder& " + method_name + "(...);");
        }
        out.push_back("    " + view.class_name + " " + view.build_method + "();");
        out.push_back("};");
        out.push_back("");
    }

    if (!out.empty() && out.back().empty())
    {
        out.pop_back();
    }
    return out;
}

std::vector<std::string> build_source_callsite_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    out.push_back("int main() {");
    for (const MonolithicClassView& view : views)
    {
        for (const SingletonCallsiteEvidence& callsite : view.source_callsites)
        {
            out.push_back(
                "    " + view.class_name + " " + callsite.variable_name +
                " = " + view.class_name + "::instance();");
            for (const std::string& chain_call : callsite.config_chain)
            {
                const std::string method_name = method_name_from_chain_call(chain_call);
                if (!method_name.empty())
                {
                    out.push_back("    " + callsite.variable_name + "." + method_name + "(...);");
                }
            }
            for (const std::string& method_name : callsite.operational_methods)
            {
                out.push_back("    " + callsite.variable_name + "." + method_name + "(...);");
            }
        }
    }
    out.push_back("}");
    return out;
}

std::vector<std::string> build_target_callsite_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    out.push_back("int main() {");
    for (const MonolithicClassView& view : views)
    {
        const std::vector<SingletonCallsiteEvidence>& callsites =
            view.target_callsites.empty() ? view.source_callsites : view.target_callsites;
        for (const SingletonCallsiteEvidence& callsite : callsites)
        {
            std::ostringstream rewritten;
            rewritten
                << "    " << view.class_name << " " << callsite.variable_name
                << " = " << view.class_name << "Builder()";

            bool has_chain = false;
            for (const std::string& chain_call : callsite.config_chain)
            {
                const std::string method_name = method_name_from_chain_call(chain_call);
                if (!method_name.empty())
                {
                    rewritten << "." << method_name << "(...)";
                    has_chain = true;
                }
            }
            if (!has_chain)
            {
                for (const std::string& method_name : view.builder_setter_methods)
                {
                    rewritten << "." << method_name << "(...)";
                }
            }
            rewritten << "." << view.build_method << "();";
            out.push_back(rewritten.str());

            for (const std::string& method_name : callsite.operational_methods)
            {
                out.push_back("    " + callsite.variable_name + "." + method_name + "(...);");
            }
        }
    }
    out.push_back("}");
    return out;
}

bool validate_monolithic_structure(
    const std::vector<std::string>& type_skeleton,
    const std::vector<std::string>& callsite_skeleton)
{
    for (const std::string& line : type_skeleton)
    {
        const std::string t = trim(line);
        if (t.find("int main") != std::string::npos ||
            t.find("Builder()") != std::string::npos ||
            t.find(" = ") != std::string::npos)
        {
            return false;
        }
    }

    bool has_main_open = false;
    bool has_main_close = false;
    for (const std::string& line : callsite_skeleton)
    {
        const std::string t = trim(line);
        if (starts_with(t, "class "))
        {
            return false;
        }
        if (t == "int main() {")
        {
            has_main_open = true;
        }
        if (t == "}")
        {
            has_main_close = true;
        }
    }
    return has_main_open && has_main_close;
}

void append_evidence_section(
    std::ostringstream& out,
    const std::string& title,
    const std::vector<std::string>& lines)
{
    out << title << "\n";
    if (lines.empty())
    {
        out << "- (none)\n\n";
        return;
    }

    for (const std::string& line : lines)
    {
        out << "- " << line << "\n";
    }
    out << "\n";
}

void append_code_section(
    std::ostringstream& out,
    const std::string& title,
    const std::vector<std::string>& lines)
{
    out << title << "\n\n";
    for (const std::string& line : lines)
    {
        out << line << "\n";
    }
}

std::string build_monolithic_evidence_view(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view)
{
    const EvidenceScanResult source_scan = scan_pattern_evidence(source_code);
    const bool has_target = !target_code.empty();
    EvidenceScanResult target_scan;
    if (has_target)
    {
        target_scan = scan_pattern_evidence(target_code);
    }

    std::vector<MonolithicClassView> class_views =
        build_class_views(source_scan, has_target ? &target_scan : nullptr);
    std::vector<std::string> type_skeleton =
        target_view ? build_target_type_skeleton_lines(class_views)
                    : build_source_type_skeleton_lines(class_views);
    std::vector<std::string> callsite_skeleton =
        target_view ? build_target_callsite_skeleton_lines(class_views)
                    : build_source_callsite_skeleton_lines(class_views);

    if (!validate_monolithic_structure(type_skeleton, callsite_skeleton))
    {
        type_skeleton.clear();
        callsite_skeleton = {"int main() {", "}"};
    }

    std::ostringstream out;
    out << (target_view
                ? "// Monolithic/Target Code View (Builder)\n\n"
                : "// Monolithic/Base Code View (Singleton)\n\n");

    if (target_view)
    {
        append_evidence_section(out, "EVIDENCE_REMOVED:", build_target_evidence_removed_lines(class_views));
        append_evidence_section(out, "EVIDENCE_ADDED:", build_target_evidence_added_lines(class_views));
    }
    else
    {
        append_evidence_section(out, "EVIDENCE_PRESENT:", build_source_evidence_present_lines(class_views));
    }

    append_code_section(out, "TYPE_SKELETON:", type_skeleton);
    out << "\n";
    append_code_section(out, "CALLSITE_SKELETON:", callsite_skeleton);
    return out.str();
}

struct ConfigMethodModel
{
    std::string method_name;
    bool takes_parameter = false;
    std::string parameter_type;
    std::string parameter_name;
    std::string field_name;
    std::string has_flag_name;
};

struct ClassBuilderModel
{
    std::string class_name;
    std::vector<ConfigMethodModel> methods;
};

std::string derive_field_base_name(const ConfigMethodModel& method)
{
    std::string base = method.parameter_name;
    if (base.empty())
    {
        const std::string lowered = lower(method.method_name);
        const std::vector<std::string> prefixes = {"set", "with", "enable", "disable", "configure"};
        for (const std::string& prefix : prefixes)
        {
            if (starts_with(lowered, prefix))
            {
                base = method.method_name.substr(prefix.size());
                break;
            }
        }
    }

    if (base.empty())
    {
        base = method.method_name;
    }

    std::string sanitized;
    sanitized.reserve(base.size());
    for (char c : base)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            sanitized.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
        }
    }

    if (sanitized.empty())
    {
        sanitized = "config";
    }

    return sanitized;
}

std::vector<ConfigMethodModel> collect_config_methods_for_class(const ParseTreeNode& parse_root, const std::string& class_name)
{
    const ParseTreeNode* class_node = nullptr;
    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node) && class_name_from_signature(node->value) == class_name)
        {
            class_node = node;
            break;
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    if (class_node == nullptr)
    {
        return {};
    }

    std::vector<ConfigMethodModel> methods;
    std::unordered_set<std::string> seen_method_names;

    for (const ParseTreeNode& fn_node : class_node->children)
    {
        if (!is_function_block(fn_node))
        {
            continue;
        }

        const std::string method_name = function_name_from_signature(fn_node.value);
        if (!is_config_method_name(method_name))
        {
            continue;
        }

        if (!seen_method_names.insert(method_name).second)
        {
            continue;
        }

        ConfigMethodModel method;
        method.method_name = method_name;

        const std::string signature = trim(fn_node.value);
        const size_t open = signature.find('(');
        const size_t close = signature.find(')', open == std::string::npos ? 0 : open + 1);
        if (open == std::string::npos || close == std::string::npos || close < open)
        {
            continue;
        }

        const std::string params = trim(signature.substr(open + 1, close - open - 1));
        if (!params.empty())
        {
            if (params.find(',') != std::string::npos)
            {
                // Keep the transformer minimal: support one-parameter config methods only.
                continue;
            }

            const std::vector<std::string> words = split_words(params);
            if (words.size() < 2)
            {
                continue;
            }

            method.parameter_name = words.back();
            const size_t name_pos = params.rfind(method.parameter_name);
            if (name_pos == std::string::npos)
            {
                continue;
            }

            method.parameter_type = trim(params.substr(0, name_pos));
            if (method.parameter_type.empty())
            {
                continue;
            }
            method.takes_parameter = true;
        }

        methods.push_back(std::move(method));
    }

    std::unordered_map<std::string, size_t> field_name_counts;
    for (ConfigMethodModel& method : methods)
    {
        const std::string base = derive_field_base_name(method);
        size_t count = field_name_counts[base]++;
        const std::string suffix = count == 0 ? "" : ("_" + std::to_string(count + 1));

        method.field_name = base + suffix + "_value";
        method.has_flag_name = "has_" + base + suffix;
    }

    return methods;
}

std::string generate_builder_class_code(const ClassBuilderModel& model)
{
    std::ostringstream out;
    out << "class " << model.class_name << "Builder {\n";
    out << "public:\n";

    for (const ConfigMethodModel& method : model.methods)
    {
        out << "    " << model.class_name << "Builder& " << method.method_name << "(";
        if (method.takes_parameter)
        {
            out << method.parameter_type << " " << method.parameter_name;
        }
        out << ") {\n";
        if (method.takes_parameter)
        {
            out << "        " << method.field_name << " = " << method.parameter_name << ";\n";
        }
        out << "        " << method.has_flag_name << " = true;\n";
        out << "        return *this;\n";
        out << "    }\n\n";
    }

    out << "    " << model.class_name << " build() const {\n";
    out << "        " << model.class_name << " product;\n";
    for (const ConfigMethodModel& method : model.methods)
    {
        out << "        if (" << method.has_flag_name << ") {\n";
        out << "            product." << method.method_name << "(";
        if (method.takes_parameter)
        {
            out << method.field_name;
        }
        out << ");\n";
        out << "        }\n";
    }
    out << "        return product;\n";
    out << "    }\n\n";

    out << "private:\n";
    for (const ConfigMethodModel& method : model.methods)
    {
        if (method.takes_parameter)
        {
            out << "    " << method.parameter_type << " " << method.field_name << "{};\n";
        }
        out << "    bool " << method.has_flag_name << " = false;\n";
    }
    out << "};\n";

    return out.str();
}

bool inject_builder_class(std::string& source, const ClassBuilderModel& model)
{
    const std::string class_kw = "class " + model.class_name;
    const std::string struct_kw = "struct " + model.class_name;

    size_t class_pos = source.find(class_kw);
    if (class_pos == std::string::npos)
    {
        class_pos = source.find(struct_kw);
    }
    if (class_pos == std::string::npos)
    {
        return false;
    }

    const size_t open_brace = source.find('{', class_pos);
    if (open_brace == std::string::npos)
    {
        return false;
    }

    const size_t close_brace = find_matching_brace(source, open_brace);
    if (close_brace == std::string::npos)
    {
        return false;
    }

    size_t insert_pos = source.find(';', close_brace);
    if (insert_pos == std::string::npos)
    {
        insert_pos = close_brace;
    }

    const std::string builder_name = model.class_name + "Builder";
    if (source.find("class " + builder_name) != std::string::npos ||
        source.find("struct " + builder_name) != std::string::npos)
    {
        return true;
    }

    const std::string builder_code = "\n\n" + generate_builder_class_code(model);
    source.insert(insert_pos + 1, builder_code);
    return true;
}

bool rewrite_simple_singleton_callsite_to_builder(std::string& source, const ClassBuilderModel& model)
{
    std::unordered_set<std::string> config_method_names;
    for (const ConfigMethodModel& method : model.methods)
    {
        config_method_names.insert(method.method_name);
    }

    std::vector<std::string> lines = split_lines(source);
    const std::regex decl_regex(
        R"(^(\s*))" + model.class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)" +
        model.class_name + R"(::\s*instance\s*\(\s*\)\s*;\s*$)");

    for (size_t i = 0; i < lines.size(); ++i)
    {
        std::smatch decl_match;
        if (!std::regex_match(lines[i], decl_match, decl_regex))
        {
            continue;
        }

        const std::string indent = decl_match[1].str();
        const std::string variable_name = decl_match[2].str();
        const std::regex method_call_regex(
            R"(^\s*)" + variable_name + R"(\.([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;\s*$)");

        size_t j = i + 1;
        std::vector<std::string> chain_calls;
        while (j < lines.size())
        {
            std::smatch call_match;
            if (!std::regex_match(lines[j], call_match, method_call_regex))
            {
                break;
            }

            const std::string method_name = call_match[1].str();
            if (config_method_names.find(method_name) == config_method_names.end())
            {
                break;
            }

            chain_calls.push_back("." + method_name + "(" + trim(call_match[2].str()) + ")");
            ++j;
        }

        if (chain_calls.empty())
        {
            continue;
        }

        std::ostringstream rewritten_line;
        rewritten_line << indent
                      << model.class_name << " " << variable_name
                      << " = " << model.class_name << "Builder()";
        for (const std::string& call : chain_calls)
        {
            rewritten_line << call;
        }
        rewritten_line << ".build();";

        lines[i] = rewritten_line.str();
        lines.erase(lines.begin() + static_cast<std::ptrdiff_t>(i + 1), lines.begin() + static_cast<std::ptrdiff_t>(j));
        source = join_lines(lines);
        return true;
    }

    return false;
}

std::string transform_to_singleton_by_class_references(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    std::string out = source;
    const std::vector<std::string> crucial_classes =
        extract_crucial_class_names(out, source_pattern, target_pattern);

    for (const std::string& class_name : crucial_classes)
    {
        inject_singleton_accessor(out, class_name);
        rewrite_class_instantiations_to_singleton_references(out, class_name);
    }

    return out;
}

std::string transform_singleton_to_builder(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    ParseTreeBuildContext context;
    context.source_pattern = source_pattern;
    context.target_pattern = target_pattern;

    std::vector<SourceFileUnit> files;
    files.push_back(SourceFileUnit{"<memory>", source});

    const ParseTreeBundle bundle = build_cpp_parse_trees(files, context);
    const ParseTreeSymbolTables symbols = build_parse_tree_symbol_tables(bundle.main_tree);
    const CreationalTreeNode singleton_tree = build_singleton_pattern_tree(bundle.main_tree);
    const std::unordered_map<std::string, std::string> singleton_strength_by_class =
        collect_singleton_strength_by_class(singleton_tree);

    std::unordered_map<std::string, TransformDecision> decisions_by_class;
    for (const ParseSymbol& symbol : class_symbol_table(symbols))
    {
        ensure_decision(decisions_by_class, symbol.name);
    }

    std::string out = source;
    for (const ParseSymbol& symbol : class_symbol_table(symbols))
    {
        TransformDecision& decision = ensure_decision(decisions_by_class, symbol.name);
        decision.transform_applied = false;
        decision.transform_reason.clear();

        const auto singleton_hit = singleton_strength_by_class.find(symbol.name);
        if (singleton_hit == singleton_strength_by_class.end())
        {
            add_reason_if_missing(decision, "singleton_candidate_not_found");
            continue;
        }

        if (singleton_hit->second == "weak")
        {
            add_reason_if_missing(decision, "singleton_candidate_weak_return_by_value");
            continue;
        }

        ClassBuilderModel model;
        model.class_name = symbol.name;
        model.methods = collect_config_methods_for_class(bundle.main_tree, symbol.name);
        if (model.methods.empty())
        {
            add_reason_if_missing(decision, "no_config_methods_for_builder_synthesis");
            continue;
        }

        if (!inject_builder_class(out, model))
        {
            add_reason_if_missing(decision, "singleton_candidate_not_found");
            continue;
        }

        const bool rewritten = rewrite_simple_singleton_callsite_to_builder(out, model);
        if (!rewritten)
        {
            add_reason_if_missing(decision, "rewrite_failed_callsite_not_supported");
            continue;
        }

        decision.transform_applied = true;
        decision.transform_reason.clear();
    }

    g_last_transform_decisions.clear();
    for (const ParseSymbol& symbol : class_symbol_table(symbols))
    {
        auto it = decisions_by_class.find(symbol.name);
        if (it != decisions_by_class.end())
        {
            g_last_transform_decisions.push_back(it->second);
        }
    }

    return out;
}

using TransformFn = std::string (*)(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

struct TransformRule
{
    const char* source_pattern;
    const char* target_pattern;
    TransformFn transform;
};

bool pattern_matches(const std::string& normalized_input, const char* expected_pattern)
{
    const std::string expected = lower(expected_pattern == nullptr ? "" : expected_pattern);
    return expected == "*" || expected == normalized_input;
}

const std::vector<TransformRule>& transform_rules()
{
    static const std::vector<TransformRule> rules = {
        {"singleton", "builder", &transform_singleton_to_builder},
        {"*", "singleton", &transform_to_singleton_by_class_references},
    };
    return rules;
}

std::string transform_using_registered_rule(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    g_last_transform_decisions.clear();

    const std::string normalized_source = lower(source_pattern);
    const std::string normalized_target = lower(target_pattern);

    for (const TransformRule& rule : transform_rules())
    {
        if (!pattern_matches(normalized_source, rule.source_pattern))
        {
            continue;
        }
        if (!pattern_matches(normalized_target, rule.target_pattern))
        {
            continue;
        }
        return rule.transform(source, source_pattern, target_pattern);
    }

    return source;
}
} // namespace

const std::vector<TransformDecision>& get_last_transform_decisions()
{
    return g_last_transform_decisions;
}

std::string generate_base_code_from_source(const std::string& source)
{
    return build_monolithic_evidence_view(source, "", false);
}

std::string generate_target_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    const std::string transformed = transform_using_registered_rule(source, source_pattern, target_pattern);
    return build_monolithic_evidence_view(source, transformed, true);
}
