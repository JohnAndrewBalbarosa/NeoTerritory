#include "Internal/parse_tree_code_generator_internal.hpp"
#include "Internal/parse_tree_code_generator_monolithic_internal.hpp"

#include <regex>
#include <sstream>
#include <string>
#include <vector>

namespace parse_tree_codegen_internal
{
namespace
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
                const std::string method_name =
                    chain_call.size() > 1 ? chain_call.substr(1, chain_call.find('(') - 1) : "";
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
                const size_t open = chain_call.find('(');
                const std::string method_name =
                    (chain_call.size() > 1 && open != std::string::npos && open > 1)
                        ? chain_call.substr(1, open - 1)
                        : "";
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
                const size_t open = chain_call.find('(');
                const std::string method_name =
                    (chain_call.size() > 1 && open != std::string::npos && open > 1)
                        ? chain_call.substr(1, open - 1)
                        : "";
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
} // namespace

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
} // namespace parse_tree_codegen_internal
