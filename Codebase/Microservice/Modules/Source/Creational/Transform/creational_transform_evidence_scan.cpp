#include "internal/creational_transform_evidence_internal.hpp"

#include <regex>
#include <unordered_set>
#include <utility>

namespace creational_codegen_internal
{
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

} // namespace creational_codegen_internal
