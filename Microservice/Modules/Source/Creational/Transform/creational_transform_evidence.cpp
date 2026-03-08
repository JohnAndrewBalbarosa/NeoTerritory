#include "Transform/creational_code_generator_internal.hpp"

#include <regex>
#include <sstream>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

namespace creational_codegen_internal
{
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

std::string retain_single_main_function(
    const std::string& code,
    const std::string& preferred_file_hint)
{
    const std::vector<std::string> lines = split_lines(code);
    std::vector<std::string> out;
    out.reserve(lines.size());

    const std::regex main_signature_regex(R"(^\s*(?:int|auto)\s+main\s*\()");
    const std::regex file_marker_regex(R"(^\s*//\s*===\s*FILE:\s*(.+?)\s*===\s*$)");

    struct MainOccurrence
    {
        size_t line_index = 0;
        std::string file_marker;
    };

    std::vector<MainOccurrence> main_occurrences;
    std::string current_file_marker;
    for (size_t i = 0; i < lines.size(); ++i)
    {
        std::smatch marker_match;
        if (std::regex_match(lines[i], marker_match, file_marker_regex))
        {
            current_file_marker = lower(trim(regex_capture_or_empty(marker_match, 1)));
        }

        if (std::regex_search(lines[i], main_signature_regex))
        {
            main_occurrences.push_back(MainOccurrence{i, current_file_marker});
        }
    }

    if (main_occurrences.empty())
    {
        return code;
    }

    size_t keep_main_line_index = main_occurrences.front().line_index;
    const std::string normalized_hint = lower(trim(preferred_file_hint));
    if (!normalized_hint.empty())
    {
        bool matched_by_hint = false;
        for (const MainOccurrence& occurrence : main_occurrences)
        {
            if (occurrence.file_marker.find(normalized_hint) != std::string::npos)
            {
                keep_main_line_index = occurrence.line_index;
                matched_by_hint = true;
                break;
            }
        }

        if (!matched_by_hint)
        {
            const size_t separator = normalized_hint.find("_to_");
            if (separator != std::string::npos)
            {
                const std::string source_hint = normalized_hint.substr(0, separator);
                for (const MainOccurrence& occurrence : main_occurrences)
                {
                    if (occurrence.file_marker.find(source_hint) != std::string::npos)
                    {
                        keep_main_line_index = occurrence.line_index;
                        break;
                    }
                }
            }
        }
    }

    bool kept_main = false;
    bool skipping_main = false;
    bool skip_has_open_brace = false;
    int skip_depth = 0;

    for (size_t i = 0; i < lines.size(); ++i)
    {
        const std::string& line = lines[i];
        if (skipping_main)
        {
            if (line.find('{') != std::string::npos)
            {
                skip_has_open_brace = true;
            }
            skip_depth += brace_delta(line);
            if (skip_has_open_brace && skip_depth <= 0)
            {
                skipping_main = false;
                skip_has_open_brace = false;
                skip_depth = 0;
            }
            continue;
        }

        if (std::regex_search(line, main_signature_regex))
        {
            if (!kept_main && i == keep_main_line_index)
            {
                kept_main = true;
                out.push_back(line);
                continue;
            }

            skipping_main = true;
            skip_has_open_brace = line.find('{') != std::string::npos;
            skip_depth = brace_delta(line);
            if (skip_has_open_brace && skip_depth <= 0)
            {
                skipping_main = false;
                skip_has_open_brace = false;
                skip_depth = 0;
            }
            continue;
        }

        out.push_back(line);
    }

    return join_lines(out);
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
                    out.push_back("    " + callsite.variable_name + "." + method_name + "();");
                }
            }
            for (const std::string& method_name : callsite.operational_methods)
            {
                out.push_back("    " + callsite.variable_name + "." + method_name + "();");
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
                    rewritten << "." << method_name << "()";
                    has_chain = true;
                }
            }
            if (!has_chain)
            {
                for (const std::string& method_name : view.builder_setter_methods)
                {
                    rewritten << "." << method_name << "()";
                }
            }
            rewritten << "." << view.build_method << "();";
            out.push_back(rewritten.str());

            for (const std::string& method_name : callsite.operational_methods)
            {
                out.push_back("    " + callsite.variable_name + "." + method_name + "();");
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
    out << "// " << title << "\n";
    if (lines.empty())
    {
        out << "// - (none)\n\n";
        return;
    }

    for (const std::string& line : lines)
    {
        out << "// - " << line << "\n";
    }
    out << "\n";
}

void append_code_section(
    std::ostringstream& out,
    const std::string& title,
    const std::vector<std::string>& lines)
{
    out << "// " << title << "\n\n";
    for (const std::string& line : lines)
    {
        out << line << "\n";
    }
}

std::string build_monolithic_evidence_view(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    const std::string normalized_source_pattern = lower(trim(source_pattern));
    const std::string normalized_target_pattern = lower(trim(target_pattern));
    const bool explicit_patterns = !normalized_source_pattern.empty() || !normalized_target_pattern.empty();
    const bool singleton_to_builder_view =
        !explicit_patterns ||
        (normalized_source_pattern == "singleton" && normalized_target_pattern == "builder");

    if (!singleton_to_builder_view)
    {
        const std::string passthrough_code =
            target_view
                ? (target_code.empty() ? source_code : target_code)
                : source_code;

        // Merged input view can contain multiple sample entry points.
        // Keep one preferred main() so generated passthrough files stay compilable.
        std::string preferred_file_hint;
        if (!normalized_source_pattern.empty() && !normalized_target_pattern.empty())
        {
            preferred_file_hint = normalized_source_pattern + "_to_" + normalized_target_pattern;
        }
        return retain_single_main_function(passthrough_code, preferred_file_hint);
    }

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

} // namespace creational_codegen_internal


