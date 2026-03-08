#include "internal/creational_transform_evidence_internal.hpp"

#include <regex>
#include <unordered_set>
#include <utility>

namespace creational_codegen_internal
{
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

} // namespace creational_codegen_internal
