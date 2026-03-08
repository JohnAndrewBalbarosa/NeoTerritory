#include "internal/creational_transform_evidence_internal.hpp"

#include <regex>
#include <sstream>

namespace creational_codegen_internal
{
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
} // namespace creational_codegen_internal
